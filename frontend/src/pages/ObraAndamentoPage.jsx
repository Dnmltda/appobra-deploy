import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Building2, Home, Plus, ChevronRight, Layers, Package, Pencil, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro, falhaAoCarregar } from '@/lib/erros.js';
import { podeEditarEstrutura } from '@/lib/permissoes.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';

// Andamento da obra por andar/unidade/serviço (pedido do Diego, 31/10/2026).
// Gestão da obra (Administrador, Gerência, Engenheiro, Mestre de Obras) monta
// a estrutura e muda os status; os demais só acompanham. Quem garante é o
// servidor (pb_hooks/estrutura-obra.pb.js); aqui só não mostramos os botões.
const STATUS = ['Não iniciado', 'Em andamento', 'Concluído'];
const CHAVE_STATUS = { 'Não iniciado': 'est_naoIniciado', 'Em andamento': 'est_emAndamento', 'Concluído': 'est_concluido' };
const COR_STATUS = {
  'Não iniciado': 'bg-muted text-muted-foreground border-border',
  'Em andamento': 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200',
  'Concluído': 'bg-green-100 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-200',
};
const COMODOS_CASA = ['Cozinha', 'Sala', 'Banheiro', 'Área de serviço', 'Corredor', 'Varanda', 'Garagem'];
const COMUNS_ANDAR = ['Corredor', 'Hall', 'Escada'];

const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
const fmt = (n) => `${Math.round(n)}%`;

// Escolha múltipla com opção de digitar outro nome.
const ListaNomes = ({ sugestoes, valor, onChange, placeholder }) => {
  const [outro, setOutro] = useState('');
  const todos = [...sugestoes, ...valor.filter((v) => !sugestoes.includes(v))];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {todos.map((n) => {
          const on = valor.includes(n);
          return (
            <button key={n} type="button" onClick={() => onChange(on ? valor.filter((x) => x !== n) : [...valor, n])}
              className={`px-3 py-1.5 rounded-full border text-sm ${on ? 'bg-royal text-white border-royal' : 'bg-background'}`}>{n}</button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input value={outro} onChange={(e) => setOutro(e.target.value)} placeholder={placeholder} />
        <Button type="button" variant="outline" aria-label="+" onClick={() => {
          const n = outro.trim();
          if (n && !valor.includes(n)) onChange([...valor, n]);
          setOutro('');
        }}><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

const ObraAndamentoPage = () => {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const tt = (k) => t(k, language);
  const edita = podeEditarEstrutura(currentUser);

  const [obra, setObra] = useState(null);
  const [andares, setAndares] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [andarSel, setAndarSel] = useState(null);
  const [unidadeSel, setUnidadeSel] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // Formulários
  const [montar, setMontar] = useState({ tipo: 'Prédio', andares: '', quartos: '', comodos: ['Cozinha', 'Sala', 'Banheiro'] });
  const [divisao, setDivisao] = useState(null); // { aptos, comuns }
  const [novoComodo, setNovoComodo] = useState('');

  const carregar = useCallback(async () => {
    try {
      const o = await pb.collection('obras').getOne(id, { $autoCancel: false });
      const f = { filter: `obra_id = "${id}" && ativo = true`, $autoCancel: false };
      const [a, u, s, c] = await Promise.all([
        pb.collection('obras_andares').getFullList({ ...f, sort: 'ordem' }),
        pb.collection('obras_unidades').getFullList({ ...f, sort: 'ordem' }),
        pb.collection('obras_unidade_servicos').getFullList({ ...f, sort: 'created' }),
        pb.collection('servicos_padrao').getFullList({ filter: 'ativo = true', sort: 'ordem,nome', $autoCancel: false }).catch(() => []),
      ]);
      setObra(o); setAndares(a); setUnidades(u); setServicos(s); setCatalogo(c);
    } catch (err) {
      falhaAoCarregar(tt('est_andamento'))(err);
    } finally {
      setCarregando(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Mesma conta do servidor: unidade = concluídos ÷ serviços; andar = média das
  // unidades; obra = média dos andares (Prédio) ou das unidades (Casa).
  const servDe = useCallback((uid) => servicos.filter((s) => s.unidade_id === uid), [servicos]);
  const pctUnidade = useCallback((uid) => {
    const l = servDe(uid);
    return l.length ? (l.filter((s) => s.status === 'Concluído').length / l.length) * 100 : 0;
  }, [servDe]);
  const unidadesDe = useCallback((aid) => unidades.filter((u) => (aid ? u.andar_id === aid : !u.andar_id)), [unidades]);
  const pctAndar = useCallback((aid) => media(unidadesDe(aid).map((u) => pctUnidade(u.id))), [unidadesDe, pctUnidade]);
  const pendencias = (lista) => lista.reduce((n, u) => n + servDe(u.id).filter((s) => s.status !== 'Concluído').length, 0);
  const pctObra = useMemo(() => (andares.length ? media(andares.map((a) => pctAndar(a.id))) : media(unidades.map((u) => pctUnidade(u.id)))),
    [andares, unidades, pctAndar, pctUnidade]);

  const tipo = obra?.tipo_estrutura || '';
  const temEstrutura = tipo === 'Prédio' || tipo === 'Casa';
  const andar = andares.find((a) => a.id === andarSel) || null;
  const unidade = unidades.find((u) => u.id === unidadeSel) || null;

  const executar = async (fn, okMsg) => {
    setOcupado(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await carregar();
    } catch (err) {
      toast.error(mensagemErro(err, tt('est_erroSalvar')));
    } finally {
      setOcupado(false);
    }
  };

  const montarEstrutura = () => executar(async () => {
    const corpo = montar.tipo === 'Prédio'
      ? { obra_id: id, tipo: 'Prédio', andares: Number(montar.andares) }
      : { obra_id: id, tipo: 'Casa', quartos: Number(montar.quartos || 0), comodos: montar.comodos };
    await pb.send('/api/custom/estrutura/gerar', { method: 'POST', body: corpo, $autoCancel: false });
    auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.PROJECTS, `Estrutura montada na obra ${obra?.nome}: ${montar.tipo}`);
  }, tt('est_montada'));

  const dividir = (modo) => executar(async () => {
    const corpo = modo === 'inteiro' ? { andar_id: andar.id, modo } : { andar_id: andar.id, modo, aptos: Number(divisao?.aptos || 0), comuns: divisao?.comuns || [] };
    await pb.send('/api/custom/estrutura/dividir', { method: 'POST', body: corpo, $autoCancel: false });
    auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.PROJECTS, `Unidades no ${andar.nome} da obra ${obra?.nome}`);
    setDivisao(null);
  }, tt('est_salvo'));

  const adicionarAndar = () => executar(async () => {
    const n = andares.reduce((m, a) => Math.max(m, Number(a.numero || 0)), 0) + 1;
    await pb.collection('obras_andares').create({ obra_id: id, company_id: obra.company_id, numero: n, nome: `${n}º andar`, ordem: n }, { $autoCancel: false });
  }, tt('est_salvo'));

  const adicionarComodo = () => executar(async () => {
    const nome = novoComodo.trim();
    if (!nome) return;
    await pb.collection('obras_unidades').create({ obra_id: id, company_id: obra.company_id, nome, tipo: 'Cômodo', ordem: unidades.length + 1 }, { $autoCancel: false });
    setNovoComodo('');
  }, tt('est_salvo'));

  const mudarStatus = (s) => {
    if (!edita) return;
    const prox = STATUS[(STATUS.indexOf(s.status) + 1) % STATUS.length];
    executar(async () => {
      await pb.collection('obras_unidade_servicos').update(s.id, { status: prox }, { $autoCancel: false });
      auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULES.PROJECTS, `${obra?.nome} · ${unidade?.nome}: ${s.servico_nome} → ${prox}`);
    });
  };

  const desativar = (col, rec, texto) => {
    if (!window.confirm(`${tt('est_desativar')} "${texto}"?`)) return;
    executar(async () => {
      await pb.collection(col).update(rec.id, { ativo: false }, { $autoCancel: false });
      auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULES.PROJECTS, `${obra?.nome}: desativado ${texto}`);
      if (col === 'obras_unidades') setUnidadeSel(null);
      if (col === 'obras_andares') setAndarSel(null);
    }, tt('est_salvo'));
  };

  const renomear = (col, rec) => {
    const nome = window.prompt(tt('est_renomear'), rec.nome);
    if (!nome || !nome.trim() || nome.trim() === rec.nome) return;
    executar(() => pb.collection(col).update(rec.id, { nome: nome.trim() }, { $autoCancel: false }), tt('est_salvo'));
  };

  const incluirServico = (servicoId) => executar(() => pb.collection('obras_unidade_servicos').create(
    { obra_id: id, company_id: obra.company_id, unidade_id: unidade.id, servico_id: servicoId }, { $autoCancel: false }), tt('est_salvo'));

  // ---------- pedaços da tela
  const Barra = ({ valor }) => (
    <div className="flex items-center gap-2"><Progress value={valor} className="h-2 flex-1" /><span className="text-xs font-semibold w-10 text-right">{fmt(valor)}</span></div>
  );

  const CartaoUnidade = ({ u }) => {
    const pend = pendencias([u]);
    return (
      <button type="button" onClick={() => setUnidadeSel(u.id)} className="w-full text-left" data-testid="unidade">
        <Card className="hover:border-royal transition-colors">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-marinho dark:text-foreground">{u.nome}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <Barra valor={pctUnidade(u.id)} />
            {pend > 0 && <p className="text-xs text-amber-700 dark:text-amber-300">{pend} {tt('est_pendencias')}</p>}
          </CardContent>
        </Card>
      </button>
    );
  };

  const Materiais = ({ uid }) => {
    const [lista, setLista] = useState(null);
    useEffect(() => {
      Promise.all([
        pb.collection('solicitacoes').getFullList({ filter: `unidade_id = "${uid}"`, sort: '-created', $autoCancel: false }).catch(() => []),
        pb.collection('saldo_funcionario').getFullList({ filter: `unidade_id = "${uid}" && tipo_operacao = "Utilização"`, expand: 'material_id', sort: '-created', $autoCancel: false }).catch(() => []),
      ]).then(([p, u]) => setLista([
        ...p.map((x) => ({ id: x.id, tipo: tt('est_pedido'), texto: `${x.numero_solicitacao || ''} ${x.descricao || ''}`.trim(), extra: x.status })),
        ...u.map((x) => ({ id: x.id, tipo: tt('est_uso'), texto: `${x.quantidade} ${x.expand?.material_id?.unit || ''} ${x.expand?.material_id?.name || ''}`.trim(), extra: x.data_operacao ? new Date(x.data_operacao).toLocaleDateString('pt-BR') : '' })),
      ]));
    }, [uid]);
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" />{tt('est_materiais')}</p>
          {lista === null ? <Skeleton className="h-6 w-full" /> : !lista.length ? (
            <p className="text-sm text-muted-foreground">{tt('est_semMateriais')}</p>
          ) : (
            <ul className="divide-y text-sm">
              {lista.map((m) => <li key={m.id} className="py-1.5 flex justify-between gap-2"><span><b>{m.tipo}:</b> {m.texto}</span><span className="text-muted-foreground shrink-0">{m.extra}</span></li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  };

  // ---------- telas
  let corpo;
  if (carregando) {
    corpo = <Skeleton className="h-48 w-full rounded-xl" />;
  } else if (!obra) {
    corpo = null;
  } else if (!temEstrutura) {
    corpo = !edita ? (
      <Card><CardContent className="p-6 text-muted-foreground">{tt('est_semEstruturaMsg')}</CardContent></Card>
    ) : (
      <Card>
        <CardContent className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{tt('est_semEstruturaMsg')}</p>
          <div className="space-y-2">
            <Label>{tt('est_tipoEstrutura')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {[['Prédio', Building2, 'est_predio'], ['Casa', Home, 'est_casa']].map(([v, Icone, k]) => (
                <button key={v} type="button" onClick={() => setMontar({ ...montar, tipo: v })}
                  className={`p-3 rounded-lg border flex items-center justify-center gap-2 font-semibold ${montar.tipo === v ? 'bg-royal text-white border-royal' : ''}`}>
                  <Icone className="w-4 h-4" />{tt(k)}
                </button>
              ))}
            </div>
          </div>
          {montar.tipo === 'Prédio' ? (
            <div className="space-y-2">
              <Label htmlFor="est_andares">{tt('est_quantosAndares')}</Label>
              <Input id="est_andares" type="number" min="1" max="200" inputMode="numeric" value={montar.andares} onChange={(e) => setMontar({ ...montar, andares: e.target.value })} />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="est_quartos">{tt('est_quantosQuartos')}</Label>
                <Input id="est_quartos" type="number" min="0" max="30" inputMode="numeric" value={montar.quartos} onChange={(e) => setMontar({ ...montar, quartos: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{tt('est_outrosComodos')}</Label>
                <ListaNomes sugestoes={COMODOS_CASA} valor={montar.comodos} onChange={(v) => setMontar({ ...montar, comodos: v })} placeholder={tt('est_outroComodo')} />
              </div>
            </>
          )}
          <Button className="w-full bg-royal text-white hover:bg-royal/90" disabled={ocupado} onClick={montarEstrutura}>{tt('est_montar')}</Button>
        </CardContent>
      </Card>
    );
  } else if (unidade) {
    const lista = servDe(unidade.id);
    const faltam = catalogo.filter((c) => !lista.some((s) => s.servico_id === c.id));
    corpo = (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setUnidadeSel(null)}><ArrowLeft className="w-4 h-4 mr-2" />{tt('est_voltar')}</Button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-marinho dark:text-foreground">{unidade.nome}</h2>
            {andar && <p className="text-sm text-muted-foreground">{andar.nome}</p>}
          </div>
          {edita && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" title={tt('est_renomear')} onClick={() => renomear('obras_unidades', unidade)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" title={tt('est_desativar')} onClick={() => desativar('obras_unidades', unidade, unidade.nome)}><Ban className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
        <Barra valor={pctUnidade(unidade.id)} />
        <p className="text-sm text-muted-foreground">{edita ? tt('est_tocarMuda') : tt('est_somenteVer')}</p>
        <div className="space-y-2" data-testid="servicos">
          {lista.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <button type="button" disabled={!edita || ocupado} onClick={() => mudarStatus(s)}
                className={`flex-1 flex items-center justify-between gap-2 p-3 rounded-lg border text-left ${COR_STATUS[s.status] || COR_STATUS['Não iniciado']} ${edita ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className="font-medium">{s.servico_nome}</span>
                <span className="text-xs font-semibold">{tt(CHAVE_STATUS[s.status] || 'est_naoIniciado')}</span>
              </button>
              {edita && <Button size="sm" variant="ghost" title={tt('est_desativar')} onClick={() => desativar('obras_unidade_servicos', s, s.servico_nome)}><Ban className="w-4 h-4" /></Button>}
            </div>
          ))}
        </div>
        {edita && faltam.length > 0 && (
          <Select value="" onValueChange={incluirServico}>
            <SelectTrigger><SelectValue placeholder={tt('est_incluirServico')} /></SelectTrigger>
            <SelectContent>{faltam.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Materiais uid={unidade.id} />
      </div>
    );
  } else if (tipo === 'Prédio' && andar) {
    const us = unidadesDe(andar.id);
    corpo = (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setAndarSel(null); setDivisao(null); }}><ArrowLeft className="w-4 h-4 mr-2" />{tt('est_voltar')}</Button>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold text-marinho dark:text-foreground">{andar.nome}</h2>
          {edita && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" title={tt('est_renomear')} onClick={() => renomear('obras_andares', andar)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" title={tt('est_desativar')} onClick={() => desativar('obras_andares', andar, andar.nome)}><Ban className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
        {us.length > 0 && <Barra valor={pctAndar(andar.id)} />}
        {edita && us.length === 0 && !divisao && (
          <Card><CardContent className="p-4 space-y-3">
            <p className="font-semibold">{tt('est_comoAndar')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" disabled={ocupado} onClick={() => dividir('inteiro')}><Layers className="w-4 h-4 mr-2" />{tt('est_andarInteiro')}</Button>
              <Button variant="outline" onClick={() => setDivisao({ aptos: '', comuns: ['Corredor'] })}>{tt('est_dividir')}</Button>
            </div>
          </CardContent></Card>
        )}
        {edita && divisao && (
          <Card><CardContent className="p-4 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="est_aptos">{tt('est_quantosAptos')}</Label>
              <Input id="est_aptos" type="number" min="0" max="60" inputMode="numeric" value={divisao.aptos} onChange={(e) => setDivisao({ ...divisao, aptos: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{tt('est_areasComuns')}</Label>
              <ListaNomes sugestoes={COMUNS_ANDAR} valor={divisao.comuns} onChange={(v) => setDivisao({ ...divisao, comuns: v })} placeholder={tt('est_outroComodo')} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDivisao(null)}>{tt('est_voltar')}</Button>
              <Button className="bg-royal text-white hover:bg-royal/90" disabled={ocupado} onClick={() => dividir('dividido')}>{tt('est_adicionar')}</Button>
            </div>
          </CardContent></Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{us.map((u) => <CartaoUnidade key={u.id} u={u} />)}</div>
        {edita && us.length > 0 && !divisao && (
          <Button variant="outline" onClick={() => setDivisao({ aptos: '', comuns: [] })}><Plus className="w-4 h-4 mr-2" />{tt('est_adicionarUnidades')}</Button>
        )}
      </div>
    );
  } else if (tipo === 'Prédio') {
    corpo = (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">{tt('est_andares')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {andares.map((a) => {
            const us = unidadesDe(a.id);
            const pend = pendencias(us);
            return (
              <button key={a.id} type="button" onClick={() => setAndarSel(a.id)} className="w-full text-left" data-testid="andar">
                <Card className="hover:border-royal transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-marinho dark:text-foreground">{a.nome}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <Barra valor={pctAndar(a.id)} />
                    <p className="text-xs text-muted-foreground">{us.length} {tt('est_unidades').toLowerCase()}{pend > 0 ? ` · ${pend} ${tt('est_pendencias')}` : ''}</p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
        {edita && <Button variant="outline" disabled={ocupado} onClick={adicionarAndar}><Plus className="w-4 h-4 mr-2" />{tt('est_adicionarAndar')}</Button>}
      </div>
    );
  } else {
    corpo = (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">{tt('est_comodos')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{unidadesDe(null).map((u) => <CartaoUnidade key={u.id} u={u} />)}</div>
        {edita && (
          <div className="flex gap-2 max-w-md">
            <Input value={novoComodo} onChange={(e) => setNovoComodo(e.target.value)} placeholder={tt('est_adicionarComodo')} />
            <Button variant="outline" disabled={ocupado || !novoComodo.trim()} onClick={adicionarComodo}><Plus className="w-4 h-4" /></Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Helmet><title>{`${tt('est_andamento')} - ${obra?.nome || ''} - APP OBRA`}</title></Helmet>
      <Header />
      <main className="py-6">
        <div className="app-container max-w-5xl space-y-5">
          <div>
            <Link to="/projects" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-2"><ArrowLeft className="w-4 h-4" />{t('obras', language)}</Link>
            <h1 className="text-2xl md:text-3xl font-bold text-marinho dark:text-foreground">{obra?.nome || tt('est_andamento')}</h1>
            {temEstrutura && (
              <div className="mt-3 space-y-1" data-testid="progresso-obra">
                <p className="text-sm text-muted-foreground">{tt(tipo === 'Prédio' ? 'est_predio' : 'est_casa')} · {tt('est_progresso')}</p>
                <Barra valor={pctObra} />
              </div>
            )}
          </div>
          {corpo}
        </div>
      </main>
    </>
  );
};

export default ObraAndamentoPage;
