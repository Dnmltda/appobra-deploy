import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle, ArrowLeft, Building2, Camera, ImagePlus, MessageSquare, Send, Trash2, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { podeGerirOcorrencias } from '@/lib/permissoes.js';

// Página da obra (pedido do Diego, 19/10/2026): foto, equipe e o mural onde
// quem trabalha na obra deixa recados ("fiz o serviço do 3º andar", "achei um
// alicate no 7º andar"). /obras/:id para a gestão; /minha-obra para quem está
// alocado numa obra (users.funcionario_id → funcionarios.obraId).

const TIPOS = ['Recado', 'Serviço feito', 'Problema', 'Achei um objeto', 'Falta material', 'Segurança'];
const TIPO_COR = {
  'Recado': 'bg-slate-100 text-slate-800',
  'Serviço feito': 'bg-green-100 text-green-800',
  'Problema': 'bg-red-100 text-red-800',
  'Achei um objeto': 'bg-amber-100 text-amber-800',
  'Falta material': 'bg-orange-100 text-orange-800',
  'Segurança': 'bg-purple-100 text-purple-800',
};
// Onde: escolher em vez de digitar.
const LOCAIS = ['Subsolo', 'Térreo', ...Array.from({ length: 30 }, (_, i) => `${i + 1}º andar`), 'Cobertura', 'Área externa', 'Canteiro', 'Almoxarifado'];
const STATUS_COR = {
  'Em Andamento': 'bg-blue-100 text-blue-800',
  'Concluída': 'bg-green-100 text-green-800',
  'Pausada': 'bg-yellow-100 text-yellow-800',
};

const quando = (d) => {
  const date = new Date(String(d).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ObraPage = ({ minha = false }) => {
  const { id: idDaRota } = useParams();
  const { currentUser } = useAuth();
  const gestao = podeGerirOcorrencias(currentUser);
  const [obraId, setObraId] = useState(minha ? null : idDaRota);
  const [obra, setObra] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [semEquipe, setSemEquipe] = useState([]);
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [fotoAtual, setFotoAtual] = useState(0);
  const [novo, setNovo] = useState({ tipo: 'Recado', local: '', texto: '' });
  const [fotos, setFotos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [colocar, setColocar] = useState('');
  const fotoObraRef = useRef(null);

  // /minha-obra: descobre a obra pelo cadastro de funcionário.
  useEffect(() => {
    if (!minha) { setObraId(idDaRota); return; }
    if (!currentUser?.funcionario_id) { setErro('sem-obra'); setLoading(false); return; }
    pb.collection('funcionarios').getOne(currentUser.funcionario_id, { $autoCancel: false })
      .then((f) => { if (f.obraId) setObraId(f.obraId); else { setErro('sem-obra'); setLoading(false); } })
      .catch(() => { setErro('sem-obra'); setLoading(false); });
  }, [minha, idDaRota, currentUser?.funcionario_id]);

  const carregar = useCallback(async () => {
    if (!obraId) return;
    setLoading(true);
    try {
      const o = await pb.collection('obras').getOne(obraId, { $autoCancel: false });
      setObra(o);
      const [eq, msgs] = await Promise.all([
        pb.collection('funcionarios').getFullList({
          filter: `obraId = "${obraId}" && deleted_at = ""`, sort: 'nome', expand: 'cargoId', $autoCancel: false,
        }).catch(() => []),
        pb.collection('obra_mensagens').getList(1, 100, {
          filter: `obra_id = "${obraId}"`, sort: '-created', expand: 'autor_id', $autoCancel: false,
        }).then((r) => r.items).catch(() => []),
      ]);
      setEquipe(eq);
      setMensagens(msgs);
      if (gestao) {
        pb.collection('funcionarios').getFullList({
          filter: `company_id = "${currentUser.company_id}" && deleted_at = "" && obraId != "${obraId}"`, sort: 'nome', expand: 'obraId', $autoCancel: false,
        }).then(setSemEquipe).catch(() => setSemEquipe([]));
      }
      setErro('');
    } catch (err) {
      console.error('Erro ao carregar a obra:', err);
      setErro('falha');
    } finally {
      setLoading(false);
    }
  }, [obraId, gestao, currentUser?.company_id]);

  useEffect(() => { carregar(); }, [carregar]);

  // Recados novos aparecem sozinhos.
  useEffect(() => {
    if (!obraId) return undefined;
    let ativo = true;
    const pararP = pb.collection('obra_mensagens').subscribe('*', (ev) => {
      if (ativo && ev.record?.obra_id === obraId) carregar();
    }).catch(() => {});
    // Desliga só esta escuta (não a de outras telas na mesma tabela).
    return () => { ativo = false; pararP.then((parar) => parar && parar()).catch(() => {}); };
  }, [obraId, carregar]);

  const enviar = async (e) => {
    e.preventDefault();
    if (!novo.texto.trim() && !fotos.length) { toast.error('Escreva o recado ou tire uma foto.'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('obra_id', obraId);
      fd.append('company_id', currentUser.company_id);
      fd.append('tipo', novo.tipo);
      fd.append('local', novo.local);
      fd.append('texto', novo.texto.trim());
      fotos.forEach((f) => fd.append('fotos', f));
      await pb.collection('obra_mensagens').create(fd, { $autoCancel: false });
      setNovo({ tipo: 'Recado', local: '', texto: '' });
      setFotos([]);
      toast.success('Recado publicado para a equipe da obra');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível publicar o recado'));
    } finally {
      setEnviando(false);
    }
  };

  const apagar = async (m) => {
    try {
      await pb.collection('obra_mensagens').delete(m.id, { $autoCancel: false });
      toast.success('Recado apagado');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível apagar'));
    }
  };

  const mudarObraDoFuncionario = async (func, novaObra, msg) => {
    try {
      await pb.collection('funcionarios').update(func.id, { obraId: novaObra }, { $autoCancel: false });
      toast.success(msg);
      setColocar('');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível mudar a equipe'));
    }
  };

  const adicionarFotoObra = async (files) => {
    if (!files?.length) return;
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('fotos+', f));
      await pb.collection('obras').update(obraId, fd, { $autoCancel: false });
      toast.success('Foto da obra adicionada');
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível enviar a foto'));
    }
  };

  const tirarFotoObra = async (nome) => {
    try {
      await pb.collection('obras').update(obraId, { 'fotos-': [nome] }, { $autoCancel: false });
      setFotoAtual(0);
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível tirar a foto'));
    }
  };

  if (erro === 'sem-obra') {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
          Você ainda não está em nenhuma obra. Peça ao seu encarregado para colocar você na equipe.
        </div>
      </>
    );
  }

  const fotosObra = obra?.fotos || [];
  const capa = fotosObra[fotoAtual] || fotosObra[0];

  return (
    <>
      <Helmet>
        <title>{obra ? `${obra.nome} - Obra` : 'Obra'} - DNM&LTDA</title>
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-5xl">
        {!minha && (
          <Link to="/projects" className="inline-flex items-center text-sm text-muted-foreground mb-4 hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />Obras
          </Link>
        )}
        {loading && !obra ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : erro === 'falha' || !obra ? (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="mb-4">Não foi possível abrir a obra.</p>
            <Button onClick={carregar}>Tentar novamente</Button>
          </div>
        ) : (
          <>
            {/* Foto e dados da obra */}
            <Card className="mb-6 overflow-hidden">
              <div className="relative bg-muted aspect-[16/7] sm:aspect-[16/6]">
                {capa ? (
                  <img src={pb.files.getURL(obra, capa)} alt={`Foto da obra ${obra.nome}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Building2 className="w-12 h-12 mb-2 opacity-40" />
                    <span className="text-sm">Sem foto da obra ainda</span>
                  </div>
                )}
                {gestao && (
                  <>
                    <Button size="sm" variant="secondary" className="absolute bottom-3 right-3" onClick={() => fotoObraRef.current?.click()}>
                      <ImagePlus className="w-4 h-4 mr-2" />Adicionar foto
                    </Button>
                    <input ref={fotoObraRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
                      aria-label="Foto da obra" onChange={(e) => { adicionarFotoObra(e.target.files); e.target.value = ''; }} />
                  </>
                )}
              </div>
              {fotosObra.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {fotosObra.map((f, i) => (
                    <div key={f} className="relative shrink-0">
                      <button type="button" onClick={() => setFotoAtual(i)}
                        className={`w-16 h-12 rounded overflow-hidden border-2 ${i === fotoAtual ? 'border-primary' : 'border-transparent'}`}>
                        <img src={pb.files.getURL(obra, f)} alt="" className="w-full h-full object-cover" />
                      </button>
                      {gestao && (
                        <button type="button" title="Tirar esta foto" onClick={() => tirarFotoObra(f)}
                          className="absolute -top-1 -right-1 bg-background rounded-full border p-0.5">
                          <Trash2 className="w-3 h-3 text-red-600" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold">{obra.nome}</h1>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COR[obra.status] || 'bg-gray-100 text-gray-800'}`}>{obra.status}</span>
                </div>
                {obra.descricao && <p className="text-muted-foreground">{obra.descricao}</p>}
                {(obra.dataInicio || obra.dataFim) && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {obra.dataInicio && <>Início: {new Date(obra.dataInicio).toLocaleDateString('pt-BR')}</>}
                    {obra.dataInicio && obra.dataFim && ' · '}
                    {obra.dataFim && <>Previsão de término: {new Date(obra.dataFim).toLocaleDateString('pt-BR')}</>}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mural */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" />Mural da obra</CardTitle>
                    <p className="text-sm text-muted-foreground">Todos que trabalham nesta obra veem os recados.</p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={enviar} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="msg_tipo">Assunto</Label>
                          <Select value={novo.tipo} onValueChange={(v) => setNovo({ ...novo, tipo: v })}>
                            <SelectTrigger id="msg_tipo" aria-label="Assunto"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="msg_local">Onde</Label>
                          <Select value={novo.local || 'nenhum'} onValueChange={(v) => setNovo({ ...novo, local: v === 'nenhum' ? '' : v })}>
                            <SelectTrigger id="msg_local" aria-label="Onde"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Não se aplica</SelectItem>
                              {LOCAIS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Textarea rows={3} aria-label="Recado" placeholder="Ex.: terminei o reboco do 3º andar / achei um alicate na escada"
                        value={novo.texto} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} />
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <label htmlFor="msg_fotos" className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                          <Camera className="w-5 h-5" />{fotos.length ? `${fotos.length} foto(s)` : 'Tirar ou escolher foto'}
                        </label>
                        <input id="msg_fotos" type="file" accept="image/*" capture="environment" multiple className="hidden"
                          onChange={(e) => setFotos(Array.from(e.target.files || []).slice(0, 4))} />
                        <Button type="submit" disabled={enviando}><Send className="w-4 h-4 mr-2" />{enviando ? 'Publicando...' : 'Publicar no mural'}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {mensagens.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum recado ainda. Seja o primeiro a escrever.</p>
                ) : mensagens.map((m) => {
                  const autor = m.expand?.autor_id;
                  return (
                    <Card key={m.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{autor?.name || autor?.username || 'Alguém da equipe'}</p>
                            <p className="text-xs text-muted-foreground">{quando(m.created)}{m.local ? ` · ${m.local}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className={TIPO_COR[m.tipo] || ''}>{m.tipo || 'Recado'}</Badge>
                            {(m.autor_id === currentUser.id || gestao) && (
                              <Button size="sm" variant="ghost" title="Apagar recado" onClick={() => apagar(m)}>
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {m.texto && <p className="mt-2 whitespace-pre-wrap">{m.texto}</p>}
                        {m.fotos?.length > 0 && (
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {m.fotos.map((f) => (
                              <a key={f} href={pb.files.getURL(m, f)} target="_blank" rel="noreferrer">
                                <img src={pb.files.getURL(m, f)} alt="Foto do recado" className="w-24 h-24 object-cover rounded border" />
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Equipe */}
              <Card className="h-fit">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2"><Users className="w-5 h-5" />Equipe ({equipe.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {equipe.length === 0 && <p className="text-sm text-muted-foreground">Ninguém nesta obra ainda.</p>}
                  {equipe.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{f.nome}</p>
                        <p className="text-xs text-muted-foreground">{f.expand?.cargoId?.nome || 'Sem cargo'}{f.hierarquia ? ` · ${f.hierarquia}` : ''}</p>
                      </div>
                      {gestao && (
                        <Button size="sm" variant="ghost" title="Tirar da obra"
                          onClick={() => mudarObraDoFuncionario(f, '', `${f.nome} saiu da obra`)}>
                          <UserMinus className="w-4 h-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {gestao && (
                    <div className="pt-2 space-y-2">
                      <Label htmlFor="colocar_func">Colocar funcionário nesta obra</Label>
                      <Select value={colocar} onValueChange={setColocar}>
                        <SelectTrigger id="colocar_func" aria-label="Colocar funcionário nesta obra"><SelectValue placeholder="Escolha o funcionário" /></SelectTrigger>
                        <SelectContent>
                          {semEquipe.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}{f.expand?.obraId?.nome ? ` (hoje em ${f.expand.obraId.nome})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button className="w-full" variant="outline" disabled={!colocar}
                        onClick={() => { const f = semEquipe.find((x) => x.id === colocar); if (f) mudarObraDoFuncionario(f, obraId, `${f.nome} entrou na obra`); }}>
                        <UserPlus className="w-4 h-4 mr-2" />Colocar na obra
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ObraPage;
