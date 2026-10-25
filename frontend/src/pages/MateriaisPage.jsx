import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLog, AUDIT_ACTIONS } from '@/lib/auditLogger.js';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Package,
  Boxes,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Layers,
  Zap,
  Droplet,
  Wrench,
  Hammer,
  HardHat,
  TreePine,
  Cog,
  PaintBucket,
  Image as ImageIcon,
  Upload,
  X,
} from 'lucide-react';
import IconeModulo3D from '@/components/marca/IconeModulo3D.jsx';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { coresPara, corPorNome, nomeComCor } from '@/lib/coresMaterial.js';
import { marcasPara } from '@/lib/marcasMaterial.js';
import { BotaoLerCodigo } from '@/components/LeitorCodigo.jsx';

const AUDIT_MODULE = 'Materiais';

const PER_PAGE = 10;

// Valores válidos do campo `unit` (select) da collection `materiais` existente.
// Unidades de obra (o servidor aceita as mesmas — fix-schema-telas.pb.js).
// Antes só havia un/kg/m/m2/m3/l: cimento em "saco" não dava para cadastrar.
const UNIDADE_OPTIONS = ['un', 'sc', 'cx', 'pc', 'par', 'rl', 'barra', 'lata', 'gl', 'kg', 't', 'm', 'm2', 'm3', 'l'];
const UNIDADE_NOMES = {
  un: 'unidade', sc: 'saco', cx: 'caixa', pc: 'peça', par: 'par', rl: 'rolo', barra: 'barra', lata: 'lata', gl: 'galão',
  kg: 'quilo', t: 'tonelada', m: 'metro', m2: 'metro quadrado', m3: 'metro cúbico', l: 'litro',
};
// Valores válidos do campo `status` (select) da collection `materiais` existente.
const STATUS_VALUES = ['active', 'inactive'];
const STATUS_LABELS = { active: 'Ativo', inactive: 'Inativo' };

const CATEGORIA_SUGESTOES = [
  'Materiais de Construção',
  'Acabamento',
  'Elétrica',
  'Hidráulica',
  'Ferragens',
  'Ferramentas',
  'EPI',
  'Madeira',
  'Metalúrgicos',
  'Pintura',
  'Outros',
];

// Ícone por categoria — usado no seletor de "Adicionar Material" e também
// como placeholder visual na listagem enquanto o material não tem foto.
// Pensado pra já deixar o padrão de visualização pronto pro dia em que todo
// material tiver foto própria + QR code (pedido do Diego).
const CATEGORIA_ICONS = {
  'Materiais de Construção': Building2,
  'Acabamento': Layers,
  'Elétrica': Zap,
  'Hidráulica': Droplet,
  'Ferragens': Wrench,
  'Ferramentas': Hammer,
  'EPI': HardHat,
  'Madeira': TreePine,
  'Metalúrgicos': Cog,
  'Pintura': PaintBucket,
  'Outros': Package,
};
const getCategoriaIcon = (categoria) => CATEGORIA_ICONS[categoria] || Package;

// Formulário usa os nomes reais dos campos da collection `materiais`.
const emptyForm = {
  name: '',
  code: '',
  description: '',
  category: '',
  marca: '',
  cor: '',
  codigo_barras: '',
  unit: 'un',
  quantity_in_stock: '',
  min_quantity: '0',
  unit_cost: '',
  supplier_id: '',
  status: 'active',
};

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusColor = (status) => {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'inactive':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
};

const MateriaisPage = () => {
  const { currentUser } = useAuth();
  const [materiais, setMateriais] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Seletor de categoria por ícone (Adicionar Material): ao clicar numa
  // categoria, mostra os materiais já cadastrados nela pra reaproveitar
  // nome/unidade em vez de redigitar tudo de novo.
  const [categoriaAtiva, setCategoriaAtiva] = useState(null);
  const [materiaisModelo, setMateriaisModelo] = useState([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);

  // Busca de material pronto (catálogo padrão + o que a empresa já tem), para
  // escolher em vez de digitar, no computador e no celular.
  const [buscaPronto, setBuscaPronto] = useState('');
  const [prontos, setProntos] = useState([]);

  // Foto do material — preparação pro padrão visual futuro (foto + QR code).
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  const companyId = currentUser?.company_id;

  const buildFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/"/g, '\\"');
      parts.push(`(name ~ "${q}" || code ~ "${q}" || category ~ "${q}")`);
    }
    if (filterStatus !== 'all') parts.push(`status = "${filterStatus}"`);
    return parts.join(' && ');
  }, [companyId, searchQuery, filterStatus]);

  const fetchFornecedores = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await pb.collection('fornecedores').getFullList({
        filter: `company_id = "${companyId}"`,
        sort: 'nome',
        $autoCancel: false,
      });
      setFornecedores(data);
    } catch (err) {
      console.error('Erro ao carregar fornecedores:', err);
    }
  }, [companyId]);

  // Busca os materiais já cadastrados nesta empresa para a categoria
  // clicada, pra oferecer como "modelo" ao cadastrar um novo (mesma
  // categoria/unidade, só muda marca/preço/código).
  const catalogoRef = useRef(null);
  const selecionarCategoria = useCallback(
    async (categoria) => {
      setCategoriaAtiva(categoria);
      setFormData((prev) => ({ ...prev, category: categoria }));
      if (!companyId) return;
      setCarregandoModelos(true);
      try {
        const data = await pb.collection('materiais').getFullList({
          filter: `company_id = "${companyId}" && category = "${categoria.replace(/"/g, '\\"')}"`,
          sort: 'name',
          $autoCancel: false,
        });
        // Sugestões do catálogo padrão (empresa nova começa sem materiais):
        // aparecem junto, sem repetir o que a empresa já cadastrou.
        if (!catalogoRef.current) {
          catalogoRef.current = await pb.send('/api/custom/catalogo-materiais', { $autoCancel: false }).catch(() => []);
        }
        const nomes = new Set(data.map((m) => String(m.name || '').toLowerCase()));
        const sugestoes = (catalogoRef.current || [])
          .filter((c) => c.category === categoria && !nomes.has(String(c.name).toLowerCase()))
          .map((c) => ({ ...c, id: `sug-${c.code}`, sugestao: true }));
        setMateriaisModelo([...data, ...sugestoes]);
      } catch (err) {
        console.error('Erro ao carregar materiais da categoria:', err);
        setMateriaisModelo([]);
      } finally {
        setCarregandoModelos(false);
      }
    },
    [companyId],
  );

  // Usa um material já cadastrado como modelo: aproveita nome/unidade/
  // descrição, mas deixa código, marca e preço em branco pra pessoa
  // completar os dados específicos dessa marca/variação.
  const usarMaterialModelo = (modelo) => {
    setFormData((prev) => ({
      ...prev,
      name: modelo.name || prev.name,
      category: modelo.category || prev.category,
      unit: modelo.unit || prev.unit,
      description: modelo.description || prev.description,
      code: modelo.sugestao ? modelo.code || '' : '',
      marca: '',
      unit_cost: '',
    }));
    setFormErrors({});
  };

  useEffect(() => {
    if (!dialogOpen || editing || !companyId) return;
    let cancelado = false;
    (async () => {
      try {
        if (!catalogoRef.current) {
          catalogoRef.current = await pb.send('/api/custom/catalogo-materiais', { $autoCancel: false }).catch(() => []);
        }
        const daEmpresa = await pb.collection('materiais').getFullList({
          filter: `company_id = "${companyId}"`, sort: 'name', fields: 'id,name,category,unit,description,marca', $autoCancel: false,
        }).catch(() => []);
        const nomes = new Set(daEmpresa.map((m) => String(m.name || '').toLowerCase()));
        const sugestoes = (catalogoRef.current || [])
          .filter((c) => !nomes.has(String(c.name).toLowerCase()))
          .map((c) => ({ ...c, id: `sug-${c.code}`, sugestao: true }));
        if (!cancelado) setProntos([...daEmpresa, ...sugestoes]);
      } catch (err) {
        console.error('Erro ao carregar materiais prontos:', err);
      }
    })();
    return () => { cancelado = true; };
  }, [dialogOpen, editing, companyId]);

  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const prontosVisiveis = useMemo(() => {
    const q = semAcento(buscaPronto.trim());
    if (!q) {
      // Sem busca: os mais comuns de cada categoria.
      const vistos = {};
      return prontos.filter((m) => {
        vistos[m.category] = (vistos[m.category] || 0) + 1;
        return vistos[m.category] <= 2;
      }).slice(0, 20);
    }
    return prontos.filter((m) => semAcento(`${m.name} ${m.category}`).includes(q)).slice(0, 30);
  }, [prontos, buscaPronto]);

  const escolherPronto = (modelo) => {
    usarMaterialModelo(modelo);
    setCategoriaAtiva(null);
    setBuscaPronto('');
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const removerFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
  };

  const fetchMateriais = useCallback(
    async (p = 1) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const result = await pb.collection('materiais').getList(p, PER_PAGE, {
          filter: buildFilter(),
          sort: '-created',
          expand: 'supplier_id',
          $autoCancel: false,
        });
        setMateriais(result.items);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
        setPage(p);
      } catch (err) {
        console.error('Erro ao carregar materiais:', err);
        setError(true);
        toast.error('Erro ao carregar materiais');
      } finally {
        setLoading(false);
      }
    },
    [companyId, buildFilter],
  );

  useEffect(() => {
    if (companyId) {
      fetchFornecedores();
      const t = setTimeout(() => fetchMateriais(1), 350);
      return () => clearTimeout(t);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, searchQuery, filterStatus]);

  // ---------- Duplicate check ----------
  const checkDuplicate = async (field, value, excludeId = null) => {
    if (!value || !companyId) return false;
    try {
      const filter = `company_id = "${companyId}" && ${field} = "${value.replace(/"/g, '\\"')}"`;
      const res = await pb.collection('materiais').getList(1, 1, {
        filter,
        $autoCancel: false,
      });
      if (res.items.length === 0) return false;
      if (excludeId && res.items[0].id === excludeId) return false;
      return true;
    } catch (e) {
      return false;
    }
  };

  const [marcaOutra, setMarcaOutra] = useState(false);

  const validateForm = async () => {
    const errs = {};

    if (!formData.name.trim()) errs.name = 'Nome é obrigatório';
    if (!formData.category.trim()) errs.category = 'Categoria é obrigatória';
    if (!formData.unit.trim()) errs.unit = 'Unidade de medida é obrigatória';

    const preco = Number(formData.unit_cost);
    if (formData.unit_cost === '' || formData.unit_cost === null) {
      errs.unit_cost = 'Preço unitário é obrigatório';
    } else if (Number.isNaN(preco)) {
      errs.unit_cost = 'Preço unitário inválido';
    } else if (preco < 0) {
      errs.unit_cost = 'Preço unitário deve ser maior ou igual a zero';
    }

    // Na edição o saldo não é editável (muda só por movimentação); no
    // cadastro, vazio vale 0.
    const estoque = Number(formData.quantity_in_stock || 0);
    if (editing) {
      // nada a validar
    } else if (Number.isNaN(estoque)) {
      errs.quantity_in_stock = 'Estoque inválido';
    } else if (estoque < 0) {
      errs.quantity_in_stock = 'Estoque deve ser maior ou igual a zero';
    }

    const estoqueMin = Number(formData.min_quantity || 0);
    if (!Number.isNaN(estoqueMin) && estoqueMin < 0) {
      errs.min_quantity = 'Estoque mínimo deve ser maior ou igual a zero';
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return false;

    // Duplicate checks (nome e código/SKU únicos por empresa)
    const dupNome = await checkDuplicate('name', nomeComCor(formData.name, formData.cor), editing?.id);
    if (dupNome) {
      setFormErrors((p) => ({ ...p, name: 'Já existe um material com este nome nesta empresa' }));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!companyId) {
      toast.error('Empresa não identificada');
      return;
    }
    setSaving(true);
    try {
      const ok = await validateForm();
      if (!ok) {
        setSaving(false);
        return;
      }

      // FormData pra permitir o upload da foto junto (campo file); os demais
      // campos vão como texto mesmo sem foto, o PocketBase aceita os dois.
      const fd = new FormData();
      fd.append('name', nomeComCor(formData.name, formData.cor));
      fd.append('cor', formData.cor || '');
      fd.append('description', formData.description.trim() || '');
      fd.append('category', formData.category.trim());
      fd.append('marca', formData.marca.trim());
      fd.append('codigo_barras', (formData.codigo_barras || '').trim());
      fd.append('unit', formData.unit);
      // Saldo inicial só no cadastro (o servidor registra como Entrada).
      if (!editing) fd.append('quantity_in_stock', Number(formData.quantity_in_stock || 0));
      fd.append('min_quantity', Number(formData.min_quantity || 0));
      fd.append('unit_cost', Number(formData.unit_cost));
      fd.append('supplier_id', formData.supplier_id || '');
      fd.append('status', formData.status);
      fd.append('company_id', companyId);
      if (fotoFile) {
        fd.append('foto', fotoFile);
      }
      const payload = fd;

      if (editing) {
        const updated = await pb.collection('materiais').update(editing.id, payload, {
          $autoCancel: false,
        });
        toast.success('Material atualizado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_UPDATED,
          AUDIT_MODULE,
          `Material atualizado: ${updated.name} (${updated.code})`,
        );
      } else {
        const created = await pb.collection('materiais').create(payload, {
          $autoCancel: false,
        });
        toast.success('Material cadastrado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_CREATED,
          AUDIT_MODULE,
          `Material criado: ${created.name} (${created.code})`,
        );
      }

      setDialogOpen(false);
      resetForm();
      fetchMateriais(page);
    } catch (err) {
      console.error('Erro ao salvar material:', err);
      const msg = mensagemErro(err, 'Erro ao salvar material');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (material) => {
    setEditing(material);
    // A cor fica no fim do nome; na edição ela sai do campo Nome para trocar
    // de cor sem repetir ("Fio Azul Vermelho").
    const sufixo = material.cor ? ` ${material.cor}` : '';
    const nomeSemCor = sufixo && String(material.name || '').endsWith(sufixo)
      ? material.name.slice(0, -sufixo.length) : (material.name || '');
    setFormData({
      name: nomeSemCor,
      code: material.code || '',
      description: material.description || '',
      category: material.category || '',
      marca: material.marca || '',
      cor: material.cor || '',
      codigo_barras: material.codigo_barras || '',
      unit: material.unit || 'un',
      quantity_in_stock: material.quantity_in_stock ?? '',
      min_quantity: material.min_quantity ?? 0,
      unit_cost: material.unit_cost ?? '',
      supplier_id: material.supplier_id || '',
      status: material.status || 'active',
    });
    setCategoriaAtiva(material.category || null);
    setMateriaisModelo([]);
    setFotoFile(null);
    if (material.foto) {
      try {
        setFotoPreview(pb.files.getURL(material, material.foto, { thumb: '300x300' }));
      } catch {
        setFotoPreview(null);
      }
    } else {
      setFotoPreview(null);
    }
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (id, nome) => {
    try {
      await pb.collection('materiais').delete(id, { $autoCancel: false });
      toast.success('Material arquivado (fica guardado no histórico)');
      await auditLog(AUDIT_ACTIONS.RECORD_DELETED, AUDIT_MODULE, `Material excluído: ${nome}`);
      fetchMateriais(page);
    } catch (err) {
      console.error('Erro ao arquivar material:', err);
      // Ex.: material no saldo de funcionário não pode ser arquivado (o servidor explica).
      toast.error(err?.response?.message && err.status === 403 ? err.response.message : 'Erro ao arquivar material');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setMarcaOutra(false);
    setBuscaPronto('');
    setEditing(null);
    setFormErrors({});
    setCategoriaAtiva(null);
    setMateriaisModelo([]);
    setFotoFile(null);
    setFotoPreview(null);
  };

  const stats = useMemo(() => {
    const ativos = materiais.filter((m) => m.status === 'active').length;
    const baixoEstoque = materiais.filter(
      (m) => Number(m.min_quantity || 0) > 0 && Number(m.quantity_in_stock || 0) <= Number(m.min_quantity || 0),
    ).length;
    return { ativos, baixoEstoque };
  }, [materiais]);

  if (loading && materiais.length === 0) {
    return (
      <>
        <Helmet>
          <title>Materiais - DNM&LTDA</title>
          <meta name="description" content="Gestão de materiais e estoque" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full max-w-sm mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error && materiais.length === 0) {
    return (
      <>
        <Helmet>
          <title>Materiais - DNM&LTDA</title>
          <meta name="description" content="Gestão de materiais e estoque" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar materiais</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={() => fetchMateriais(1)}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet>
          <title>Materiais - DNM&LTDA</title>
          <meta name="description" content="Gestão de materiais e estoque" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Empresa não identificada</h2>
          <p className="text-muted-foreground mb-6">Seu usuário não possui empresa vinculada.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Materiais - DNM&LTDA</title>
        <meta name="description" content="Gestão de materiais e controle de estoque do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-marinho flex items-center gap-3"><IconeModulo3D icon={Package} />Materiais</h1>
            <p className="text-muted-foreground">Gerencie os materiais e o estoque da sua empresa</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Material
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Material' : 'Adicionar Material'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editing && (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <Label htmlFor="busca_pronto">Escolha um material pronto</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="busca_pronto"
                        className="pl-9"
                        placeholder="Procure: cimento, fio, tinta, tubo, luva..."
                        value={buscaPronto}
                        onChange={(e) => setBuscaPronto(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {buscaPronto.trim() ? 'Toque no material para preencher nome, categoria e unidade.' : 'Mais usados nas obras. Toque para preencher; depois escolha cor, marca e preço.'}
                    </p>
                    {prontosVisiveis.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nada encontrado. Digite o nome do material novo no campo Nome abaixo.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {prontosVisiveis.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => escolherPronto(m)}
                            className={`text-xs px-2.5 py-1.5 rounded-full border bg-background hover:bg-primary/10 hover:border-primary transition-colors ${formData.name === m.name ? 'border-primary bg-primary/10 font-medium' : ''}`}
                          >
                            {m.name}<span className="text-muted-foreground"> · {m.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!editing && (
                  <div className="space-y-2">
                    <Label>Ou veja por categoria</Label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {CATEGORIA_SUGESTOES.filter((c) => c !== 'Outros').map((cat) => {
                        const Icone = getCategoriaIcon(cat);
                        const ativo = categoriaAtiva === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => selecionarCategoria(cat)}
                            title={cat}
                            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors ${
                              ativo ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                            }`}
                          >
                            <Icone className={`w-5 h-5 ${ativo ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="text-[10px] leading-tight line-clamp-2">{cat}</span>
                          </button>
                        );
                      })}
                    </div>

                    {categoriaAtiva && (
                      <div className="mt-2 border rounded-lg p-3 bg-muted/40">
                        <p className="text-xs text-muted-foreground mb-2">
                          Materiais de "{categoriaAtiva}" — clique para preencher nome e unidade (os com "+" são sugestões ainda não cadastradas). Depois é só completar marca e preço. Se não tiver o que você precisa, digite um material novo abaixo.
                        </p>
                        {carregandoModelos ? (
                          <p className="text-xs text-muted-foreground">Carregando...</p>
                        ) : materiaisModelo.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum material nem sugestão nesta categoria.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {materiaisModelo.map((modelo) => (
                              <button
                                key={modelo.id}
                                type="button"
                                onClick={() => usarMaterialModelo(modelo)}
                                className="text-xs px-2 py-1 rounded-full border bg-background hover:bg-primary/10 hover:border-primary transition-colors"
                              >
                                {modelo.sugestao ? '+ ' : ''}{modelo.name}{modelo.marca ? ` (${modelo.marca})` : ''}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="mat_nome">Nome *</Label>
                    <Input
                      id="mat_nome"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Cimento Portland 50kg"
                      className={formErrors.name ? 'border-destructive' : ''}
                    />
                    {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="mat_descricao">Descrição</Label>
                    <Textarea
                      id="mat_descricao"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      placeholder="Descrição opcional do material"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_categoria">Categoria *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger id="mat_categoria" className={formErrors.category ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Escolha a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {(CATEGORIA_SUGESTOES.includes(formData.category) || !formData.category
                          ? CATEGORIA_SUGESTOES : [formData.category, ...CATEGORIA_SUGESTOES]).map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.category && <p className="text-xs text-destructive">{formErrors.category}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_code">Código / SKU</Label>
                    {/* Dado pelo sistema: prefixo da categoria + número (ELE-001). */}
                    <Input id="mat_code" value={editing ? formData.code : 'Gerado pelo sistema ao salvar'} readOnly tabIndex={-1}
                      className="bg-muted/40" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_marca">Marca</Label>
                    {(() => {
                      const lista = marcasPara(formData.category, formData.name);
                      const outra = marcaOutra || (formData.marca && !lista.includes(formData.marca));
                      return (
                        <>
                          <Select
                            value={outra ? 'outra' : (formData.marca || 'nenhuma')}
                            onValueChange={(v) => {
                              setMarcaOutra(v === 'outra');
                              setFormData({ ...formData, marca: v === 'outra' || v === 'nenhuma' ? '' : v });
                            }}
                          >
                            <SelectTrigger id="mat_marca"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhuma">Sem marca / não sei</SelectItem>
                              {lista.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              <SelectItem value="outra">Outra marca (digitar)</SelectItem>
                            </SelectContent>
                          </Select>
                          {outra && (
                            <Input aria-label="Nome da marca" value={formData.marca} placeholder="Nome da marca"
                              onChange={(e) => setFormData({ ...formData, marca: e.target.value })} />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_barras">Código de barras da embalagem</Label>
                    <div className="flex gap-2">
                      <Input id="mat_barras" inputMode="numeric" placeholder="Opcional (ex.: 7891234567890)" value={formData.codigo_barras || ''}
                        onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })} />
                      <BotaoLerCodigo rotulo="Ler" onLer={(c) => setFormData((f) => ({ ...f, codigo_barras: c }))} />
                    </div>
                    <p className="text-xs text-muted-foreground">Com ele, dá para achar o material apontando a câmera para a embalagem.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_cor">Cor</Label>
                    <Select
                      value={formData.cor || 'sem'}
                      onValueChange={(v) => setFormData({ ...formData, cor: v === 'sem' ? '' : v })}
                    >
                      <SelectTrigger id="mat_cor"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem">Sem cor / não se aplica</SelectItem>
                        {(() => {
                          const lista = coresPara(formData.category, formData.name);
                          const atual = formData.cor && !lista.some((c) => c.nome === formData.cor) ? [corPorNome(formData.cor) || { nome: formData.cor, hex: '#e5e7eb' }] : [];
                          return [...atual, ...lista].map((c) => (
                            <SelectItem key={c.nome} value={c.nome}>
                              <span className="inline-flex items-center gap-2">
                                <span className="inline-block w-3.5 h-3.5 rounded-full border border-black/20" style={{ background: c.hex }} />
                                {c.nome}{c.dica ? <span className="text-muted-foreground"> ({c.dica})</span> : null}
                              </span>
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                    {formData.cor && formData.name.trim() && (
                      <p className="text-xs text-muted-foreground">Vai aparecer como: <strong>{nomeComCor(formData.name, formData.cor)}</strong></p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_preco">Preço Unitário (R$) *</Label>
                    <Input
                      id="mat_preco"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                      placeholder="0,00"
                      className={formErrors.unit_cost ? 'border-destructive' : ''}
                    />
                    {formErrors.unit_cost && <p className="text-xs text-destructive">{formErrors.unit_cost}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_unidade">Unidade de Medida *</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger id="mat_unidade" className={formErrors.unit ? 'border-destructive' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADE_OPTIONS.map((u) => (
                          <SelectItem key={u} value={u}>{u} — {UNIDADE_NOMES[u]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.unit && <p className="text-xs text-destructive">{formErrors.unit}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_estoque">{editing ? 'Estoque atual' : 'Estoque inicial'}</Label>
                    <Input
                      id="mat_estoque"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.quantity_in_stock}
                      onChange={(e) => setFormData({ ...formData, quantity_in_stock: e.target.value })}
                      placeholder="0"
                      disabled={!!editing}
                      className={formErrors.quantity_in_stock ? 'border-destructive' : ''}
                    />
                    {editing && (
                      <p className="text-xs text-muted-foreground">
                        Muda só por entrada, saída ou inventário (tela Estoque).
                      </p>
                    )}
                    {formErrors.quantity_in_stock && <p className="text-xs text-destructive">{formErrors.quantity_in_stock}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_estoque_min">Estoque Mínimo</Label>
                    <Input
                      id="mat_estoque_min"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.min_quantity}
                      onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                      placeholder="0"
                      className={formErrors.min_quantity ? 'border-destructive' : ''}
                    />
                    {formErrors.min_quantity && <p className="text-xs text-destructive">{formErrors.min_quantity}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_fornecedor">Fornecedor</Label>
                    <Select
                      value={formData.supplier_id || 'none'}
                      onValueChange={(v) => setFormData({ ...formData, supplier_id: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger id="mat_fornecedor">
                        <SelectValue placeholder="Selecione um fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {fornecedores.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome || f.razao_social || 'Fornecedor'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fornecedores.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum fornecedor cadastrado para esta empresa.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mat_status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger id="mat_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="mat_foto">Foto do material</Label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {fotoPreview ? (
                          <img src={fotoPreview} alt="Pré-visualização" className="w-full h-full object-cover" />
                        ) : (
                          (() => {
                            const Icone = getCategoriaIcon(formData.category);
                            return <Icone className="w-6 h-6 text-muted-foreground" />;
                          })()
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          id="mat_foto"
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleFotoChange}
                          className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
                        />
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Upload className="w-3 h-3" /> JPG/PNG/WebP — opcional, melhora a identificação na listagem
                        </p>
                      </div>
                      {fotoPreview && (
                        <Button type="button" size="sm" variant="ghost" onClick={removerFoto} title="Remover foto">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de materiais</p>
                <p className="text-2xl font-bold text-primary">{totalItems}</p>
              </div>
              <Package className="w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Materiais ativos</p>
                <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
              </div>
              <Boxes className="w-8 h-8 text-green-600/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estoque baixo (página)</p>
                <p className="text-2xl font-bold text-amber-600">{stats.baixoEstoque}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-amber-600/30" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar por nome, código ou categoria..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden lg:table-cell">Fornecedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materiais.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      {searchQuery || filterStatus !== 'all'
                        ? 'Nenhum material encontrado com os filtros aplicados'
                        : 'Nenhum material cadastrado. Clique em "Adicionar Material" para começar.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  materiais.map((m) => {
                    const baixo =
                      Number(m.min_quantity || 0) > 0 &&
                      Number(m.quantity_in_stock || 0) <= Number(m.min_quantity || 0);
                    const IconeCategoria = getCategoriaIcon(m.category);
                    let fotoUrl = null;
                    if (m.foto) {
                      try {
                        fotoUrl = pb.files.getURL(m, m.foto, { thumb: '100x100' });
                      } catch {
                        fotoUrl = null;
                      }
                    }
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="w-9 h-9 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
                            {fotoUrl ? (
                              <img src={fotoUrl} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              <IconeCategoria className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            {m.cor && corPorNome(m.cor) && (
                              <span className="inline-block w-3 h-3 rounded-full border border-black/20 mr-1.5 align-middle" title={m.cor}
                                style={{ background: corPorNome(m.cor).hex }} />
                            )}
                            <span>{m.name}{m.marca ? <span className="text-muted-foreground font-normal"> — {m.marca}</span> : ''}</span>
                            <span className="text-xs text-muted-foreground md:hidden">{m.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-xs px-2 py-1 bg-muted rounded-full">{m.category || '-'}</span>
                        </TableCell>
                        <TableCell>{m.code || '-'}</TableCell>
                        <TableCell>{formatCurrency(m.unit_cost)}</TableCell>
                        <TableCell>
                          <span className={baixo ? 'text-amber-600 font-semibold' : ''}>
                            {Number(m.quantity_in_stock || 0).toLocaleString('pt-BR')} {m.unit || ''}
                          </span>
                          {baixo && <span className="block text-xs text-amber-600">estoque baixo</span>}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {m.expand?.supplier_id?.nome || m.expand?.supplier_id?.razao_social || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor(m.status)}`}>
                            {STATUS_LABELS[m.status] || m.status || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(m)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Material</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja arquivar o material <strong>{m.name}</strong>? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDelete(m.id, m.name)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} • {totalItems} material(is)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => fetchMateriais(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => fetchMateriais(page + 1)}
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MateriaisPage;
