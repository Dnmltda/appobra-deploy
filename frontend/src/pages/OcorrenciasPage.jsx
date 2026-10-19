import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Camera, CheckCircle2, PlayCircle, RotateCcw, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { podeGerirOcorrencias } from '@/lib/permissoes.js';

// Módulo Ocorrências (Etapa 4.4). Regras no servidor: pb_hooks/ocorrencias.pb.js.
const TIPOS = [
  'Acidente', 'Quase acidente', 'Dano a equipamento ou material', 'Problema na obra', 'Falta de material',
  'Atraso', 'Clima', 'Furto ou sumiço', 'Outro',
];
const GRAVIDADES = [
  { valor: 'Baixa', cor: 'border-green-600 bg-green-600 text-white', badge: 'bg-green-500/10 text-green-700 border-green-500/20' },
  { valor: 'Média', cor: 'border-amber-500 bg-amber-500 text-white', badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  { valor: 'Alta', cor: 'border-red-600 bg-red-600 text-white', badge: 'bg-red-500/10 text-red-700 border-red-500/20' },
];
const STATUS_COR = {
  'Aberta': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  'Em andamento': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'Resolvida': 'bg-green-500/10 text-green-700 border-green-500/20',
  'Cancelada': 'bg-gray-500/10 text-gray-700 border-gray-500/20',
};
const FILTROS = [
  { id: 'abertas', label: 'Em aberto', filtro: '(status = "Aberta" || status = "Em andamento")' },
  { id: 'fechadas', label: 'Resolvidas', filtro: '(status = "Resolvida" || status = "Cancelada")' },
  { id: 'todas', label: 'Todas', filtro: '' },
];
const vazio = { tipo: '', gravidade: '', descricao: '', local: '', obra_id: '', envolvido_id: '', equipamento_id: '' };
const dataHoraBR = (d) => (d ? new Date(String(d).replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

const OcorrenciasPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const gestao = podeGerirOcorrencias(currentUser);

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('abertas');
  const [obras, setObras] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);

  const [novaAberta, setNovaAberta] = useState(false);
  const [form, setForm] = useState(vazio);
  const [fotos, setFotos] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const [fechar, setFechar] = useState(null); // { oc, status }
  const [providencia, setProvidencia] = useState('');

  const carregar = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const f = FILTROS.find((x) => x.id === filtro)?.filtro;
      setLista(await pb.collection('ocorrencias').getFullList({
        filter: [`company_id = "${companyId}"`, f].filter(Boolean).join(' && '),
        sort: '-created', expand: 'obra_id,registrado_por,resolvido_por,envolvido_id,equipamento_id', $autoCancel: false,
      }));
    } catch (err) {
      toast.error(mensagemErro(err, 'Erro ao carregar ocorrências'));
    } finally {
      setLoading(false);
    }
  }, [companyId, filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!companyId) return;
    const q = { filter: `company_id = "${companyId}"`, $autoCancel: false };
    pb.collection('obras').getFullList({ ...q, sort: 'nome' }).then(setObras).catch(() => {});
    pb.collection('funcionarios').getFullList({ ...q, sort: 'nome' }).then(setFuncionarios).catch(() => {});
    pb.collection('equipamentos').getFullList({ ...q, sort: 'nome' }).then(setEquipamentos).catch(() => {});
  }, [companyId]);

  const abrirNova = () => { setForm(vazio); setFotos([]); setNovaAberta(true); };

  const registrar = async () => {
    if (!form.tipo) { toast.error('Escolha o que aconteceu'); return; }
    if (!form.gravidade) { toast.error('Escolha a gravidade'); return; }
    if (!form.descricao.trim()) { toast.error('Conte o que aconteceu'); return; }
    setSalvando(true);
    try {
      const dados = { ...form, company_id: companyId };
      Object.keys(dados).forEach((k) => { if (dados[k] === '') delete dados[k]; });
      if (fotos.length) dados.fotos = fotos;
      const r = await pb.collection('ocorrencias').create(dados, { $autoCancel: false });
      toast.success(r.gravidade === 'Alta'
        ? `Ocorrência ${r.numero} registrada. A gestão foi avisada por e-mail.`
        : `Ocorrência ${r.numero} registrada.`);
      setNovaAberta(false);
      setFiltro('abertas');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar'));
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (oc, status, prov) => {
    setSalvando(true);
    try {
      await pb.collection('ocorrencias').update(oc.id, prov !== undefined ? { status, providencia: prov } : { status }, { $autoCancel: false });
      toast.success({
        'Em andamento': 'Ocorrência em andamento.',
        'Resolvida': 'Ocorrência resolvida.',
        'Cancelada': 'Ocorrência cancelada.',
        'Aberta': 'Ocorrência reaberta.',
      }[status]);
      setFechar(null);
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'));
    } finally {
      setSalvando(false);
    }
  };

  const badgeGravidade = (g) => GRAVIDADES.find((x) => x.valor === g)?.badge || '';

  return (
    <>
      <Helmet><title>Ocorrências - APP OBRA | DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-primary">Ocorrências</h1>
              <p className="text-muted-foreground">Acidentes, quase acidentes, danos, faltas e outros problemas da obra</p>
            </div>
            <Button size="lg" onClick={abrirNova}><Plus className="w-5 h-5 mr-2" />Registrar ocorrência</Button>
          </div>

          <div className="flex gap-2">
            {FILTROS.map((f) => (
              <Button key={f.id} size="sm" variant={filtro === f.id ? 'default' : 'outline'} onClick={() => setFiltro(f.id)}>{f.label}</Button>
            ))}
          </div>

          {!gestao && <p className="text-sm text-muted-foreground">Aqui aparecem as ocorrências que você registrou.</p>}

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : lista.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              {filtro === 'abertas' ? 'Nenhuma ocorrência em aberto.' : 'Nenhuma ocorrência encontrada.'}
            </CardContent></Card>
          ) : (
            lista.map((oc) => (
              <Card key={oc.id} data-testid="ocorrencia">
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{oc.numero}</span>
                    <span className="font-medium">{oc.tipo}</span>
                    <Badge variant="outline" className={badgeGravidade(oc.gravidade)}>Gravidade {oc.gravidade}</Badge>
                    <Badge variant="outline" className={STATUS_COR[oc.status] || ''}>{oc.status}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{dataHoraBR(oc.data_ocorrencia || oc.created)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{oc.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {[oc.expand?.obra_id?.nome, oc.local, oc.expand?.envolvido_id?.nome && `Envolvido: ${oc.expand.envolvido_id.nome}`,
                      oc.expand?.equipamento_id?.nome && `Equipamento: ${oc.expand.equipamento_id.nome}`,
                      `Registrada por ${oc.expand?.registrado_por?.name || '-'}`].filter(Boolean).join(' · ')}
                  </p>
                  {oc.fotos?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {oc.fotos.map((f) => (
                        <a key={f} href={pb.files.getURL(oc, f)} target="_blank" rel="noreferrer">
                          <img src={pb.files.getURL(oc, f)} alt="Foto da ocorrência" className="w-20 h-20 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  )}
                  {oc.providencia && (
                    <p className="text-sm border-l-4 border-green-600 pl-2">
                      <strong>O que foi feito:</strong> {oc.providencia}
                      {oc.expand?.resolvido_por?.name && <span className="text-muted-foreground"> — {oc.expand.resolvido_por.name}, {dataHoraBR(oc.data_resolucao)}</span>}
                    </p>
                  )}
                  {gestao && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {oc.status === 'Aberta' && (
                        <Button size="sm" variant="outline" disabled={salvando} onClick={() => mudarStatus(oc, 'Em andamento')}><PlayCircle className="w-4 h-4 mr-1" />Começar a resolver</Button>
                      )}
                      {['Aberta', 'Em andamento'].includes(oc.status) && (
                        <>
                          <Button size="sm" disabled={salvando} onClick={() => { setProvidencia(''); setFechar({ oc, status: 'Resolvida' }); }}><CheckCircle2 className="w-4 h-4 mr-1" />Marcar como resolvida</Button>
                          <Button size="sm" variant="ghost" disabled={salvando} onClick={() => { setProvidencia(''); setFechar({ oc, status: 'Cancelada' }); }}><Ban className="w-4 h-4 mr-1" />Cancelar</Button>
                        </>
                      )}
                      {['Resolvida', 'Cancelada'].includes(oc.status) && (
                        <Button size="sm" variant="outline" disabled={salvando} onClick={() => mudarStatus(oc, 'Aberta')}><RotateCcw className="w-4 h-4 mr-1" />Reabrir</Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* ---------- Registrar ---------- */}
      <Dialog open={novaAberta} onOpenChange={setNovaAberta}>
        <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar ocorrência</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="oc_tipo">O que aconteceu? *</Label>
              <Select value={form.tipo || 'none'} onValueChange={(v) => setForm({ ...form, tipo: v === 'none' ? '' : v })}>
                <SelectTrigger id="oc_tipo"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Escolha...</SelectItem>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Gravidade *</Label>
              <div className="grid grid-cols-3 gap-2">
                {GRAVIDADES.map((g) => (
                  <button key={g.valor} type="button" aria-pressed={form.gravidade === g.valor}
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${form.gravidade === g.valor ? g.cor : 'bg-background hover:bg-muted'}`}
                    onClick={() => setForm({ ...form, gravidade: g.valor })}>{g.valor}</button>
                ))}
              </div>
              {form.gravidade === 'Alta' && <p className="text-xs text-muted-foreground">A gestão recebe um aviso por e-mail.</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc_desc">Conte o que aconteceu *</Label>
              <Textarea id="oc_desc" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc_obra">Obra</Label>
              <Select value={form.obra_id || 'none'} onValueChange={(v) => setForm({ ...form, obra_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="oc_obra"><SelectValue placeholder="Sem obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem obra</SelectItem>
                  {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc_local">Onde? (opcional)</Label>
              <Input id="oc_local" placeholder="Ex.: andaime do 2º andar" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="oc_pessoa">Pessoa envolvida (opcional)</Label>
                <Select value={form.envolvido_id || 'none'} onValueChange={(v) => setForm({ ...form, envolvido_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="oc_pessoa"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="oc_equip">Equipamento (opcional)</Label>
                <Select value={form.equipamento_id || 'none'} onValueChange={(v) => setForm({ ...form, equipamento_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="oc_equip"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {equipamentos.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome || q.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="oc_fotos">Fotos (opcional, até 5)</Label>
              <label htmlFor="oc_fotos" className="flex items-center gap-2 rounded-md border border-dashed px-3 py-3 text-sm cursor-pointer hover:bg-muted">
                <Camera className="w-5 h-5" />{fotos.length ? `${fotos.length} foto(s) escolhida(s)` : 'Tirar ou escolher fotos'}
              </label>
              <input id="oc_fotos" type="file" accept="image/*" capture="environment" multiple className="hidden"
                onChange={(e) => setFotos(Array.from(e.target.files || []).slice(0, 5))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setNovaAberta(false)}>Cancelar</Button>
              <Button onClick={registrar} disabled={salvando}>{salvando ? 'Enviando...' : 'Registrar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Resolver / cancelar ---------- */}
      <Dialog open={!!fechar} onOpenChange={(open) => { if (!open) setFechar(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>{fechar?.status === 'Cancelada' ? 'Cancelar ocorrência' : 'Marcar como resolvida'}</DialogTitle></DialogHeader>
          {fechar && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{fechar.oc.numero} · {fechar.oc.tipo}</p>
              <div className="space-y-1">
                <Label htmlFor="oc_prov">{fechar.status === 'Cancelada' ? 'Por que cancelar? *' : 'O que foi feito? *'}</Label>
                <Textarea id="oc_prov" rows={3} value={providencia} onChange={(e) => setProvidencia(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFechar(null)}>Voltar</Button>
                <Button disabled={salvando || !providencia.trim()} onClick={() => mudarStatus(fechar.oc, fechar.status, providencia.trim())}>Confirmar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OcorrenciasPage;
