import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, ScanLine, History, Download, Printer, HardHat, Wrench, Box, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats as F } from 'html5-qrcode';
import { QrImagem, linkDoItem, lerConteudo, imprimirEtiqueta } from '@/components/CodigosItem.jsx';

// QR Code dos itens (Etapa 5 da auditoria): a etiqueta é de um item real da
// empresa (material, equipamento ou EPI), gerada no próprio aparelho, e a
// leitura mostra o item e fica registrada (qrcode_leituras, por empresa).
// O QR guarda o endereço do app (?ler=tipo:id): lido pela câmera comum do
// celular, abre o app direto no item.
const TIPOS = {
  material: { rotulo: 'Material', col: 'materiais', nome: (r) => r.name, codigo: (r) => r.code, pagina: '/materiais', icone: Box },
  equipamento: { rotulo: 'Equipamento', col: 'equipamentos', nome: (r) => r.nome, codigo: (r) => r.codigo_interno || r.numero_patrimonial, pagina: '/equipamentos', icone: Wrench },
  epi: { rotulo: 'EPI', col: 'epis', nome: (r) => r.nome, codigo: (r) => (r.numero_ca ? `CA ${r.numero_ca}` : r.id_unico), pagina: '/rh/epis', icone: HardHat },
};

const detalhes = (tipo, r) => {
  if (tipo === 'material') return [r.unit && `Unidade: ${r.unit}`, r.quantity_in_stock !== undefined && `Em estoque: ${r.quantity_in_stock} ${r.unit || ''}`];
  if (tipo === 'equipamento') return [r.situacao && `Situação: ${r.situacao}`, r.marca && `Marca: ${r.marca}`];
  return [r.quantidade_estoque !== undefined && `Em estoque: ${r.quantidade_estoque}`, r.tamanho && `Tamanho: ${r.tamanho}`];
};

const QRCodeModule = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const [params, setParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(params.get('ler') ? 'scan' : 'generate');
  const [tipo, setTipo] = useState('material');
  const [itens, setItens] = useState([]);
  const [itemId, setItemId] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [lido, setLido] = useState(null); // { tipo, rec } | { erro }
  const [historico, setHistorico] = useState([]);
  const scannerRef = useRef(null);

  // Itens da empresa do tipo escolhido.
  useEffect(() => {
    if (!companyId) return;
    const t = TIPOS[tipo];
    const filtro = tipo === 'material' ? `company_id = "${companyId}"` : `company_id = "${companyId}" && deleted_at = ""`;
    pb.collection(t.col).getFullList({ filter: filtro, sort: tipo === 'material' ? 'name' : 'nome', $autoCancel: false })
      .then(setItens)
      .catch(() => pb.collection(t.col).getFullList({ filter: `company_id = "${companyId}"`, $autoCancel: false }).then(setItens).catch(() => setItens([])));
    setItemId('');
    setQrUrl('');
  }, [tipo, companyId]);

  const item = itens.find((i) => i.id === itemId);

  const carregarHistorico = () => {
    if (!companyId) return;
    pb.collection('qrcode_leituras').getList(1, 50, { filter: `company_id = "${companyId}"`, sort: '-created', expand: 'usuario_id', $autoCancel: false })
      .then((r) => setHistorico(r.items)).catch(() => setHistorico([]));
  };
  useEffect(() => { if (activeTab === 'track') carregarHistorico(); }, [activeTab, companyId]);

  const abrirItem = async (conteudo) => {
    let c = lerConteudo(conteudo);
    if (!c && companyId) {
      // Código de barras da embalagem: procura o material com esse código.
      const cod = String(conteudo || '').trim().replace(/"/g, '');
      try {
        const m = await pb.collection('materiais').getFirstListItem(`company_id = "${companyId}" && codigo_barras = "${cod}"`, { $autoCancel: false });
        c = { tipo: 'material', id: m.id };
      } catch (_) { /* não achou */ }
    }
    if (!c) { setLido({ erro: `Nenhum item do APP OBRA com este código (${String(conteudo).slice(0, 40)}). Cadastre o código de barras no material.` }); return; }
    try {
      const rec = await pb.collection(TIPOS[c.tipo].col).getOne(c.id, { $autoCancel: false });
      setLido({ tipo: c.tipo, rec });
      const t = TIPOS[c.tipo];
      pb.collection('qrcode_leituras').create({
        qrcode_id: [t.codigo(rec), t.nome(rec)].filter(Boolean).join(' · ').slice(0, 200),
        item_id: rec.id, item_tipo: t.rotulo, usuario_id: currentUser?.id, acao: 'Leitura', localizacao: '',
      }, { $autoCancel: false }).catch(() => {});
    } catch (_) {
      setLido({ erro: 'Item não encontrado nesta empresa (ou foi arquivado).' });
    }
  };

  // Aberto pelo link do QR (câmera comum do celular).
  useEffect(() => {
    const ler = params.get('ler');
    if (ler && currentUser) {
      abrirItem(`?ler=${ler}`);
      params.delete('ler');
      setParams(params, { replace: true });
    }
  }, [currentUser]);

  // Leitor pela câmera, só na aba "Escanear" e sem item na tela.
  useEffect(() => {
    if (activeTab !== 'scan' || lido) return undefined;
    const t = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner('qr-reader', {
          // quadro largo: código de barras de embalagem é comprido
          qrbox: (w, h) => ({ width: Math.max(200, Math.floor(w * 0.9)), height: Math.max(150, Math.floor(h * 0.6)) }), fps: 10, rememberLastUsedCamera: true,
          formatsToSupport: [F.QR_CODE, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF],
        }, false);
        scanner.render((texto) => {
          scanner.clear().catch(() => {});
          scannerRef.current = null;
          abrirItem(texto);
        }, () => {});
        scannerRef.current = scanner;
      } catch (err) {
        console.error('Leitor de QR:', err);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [activeTab, lido]);

  const T = TIPOS[tipo];
  const linkItem = item ? linkDoItem(tipo, item.id) : '';

  return (
    <>
      <Helmet><title>QR Code - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3"><QrCode className="w-8 h-8" />QR Code</h1>
            <p className="text-muted-foreground mt-2">Etiquetas dos materiais, equipamentos e EPIs, leitura pela câmera e histórico de leituras</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-14 rounded-xl p-1 bg-card border shadow-sm">
              <TabsTrigger value="generate" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><QrCode className="w-4 h-4 mr-2" />Gerar</TabsTrigger>
              <TabsTrigger value="scan" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ScanLine className="w-4 h-4 mr-2" />Escanear</TabsTrigger>
              <TabsTrigger value="track" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="generate">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-md">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-xl">Qual item</CardTitle>
                    <CardDescription>Escolha o item cadastrado para gerar a etiqueta</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="qr-tipo">Tipo</Label>
                      <Select value={tipo} onValueChange={setTipo}>
                        <SelectTrigger id="qr-tipo" aria-label="Tipo"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPOS).map(([k, t]) => <SelectItem key={k} value={k}>{t.rotulo}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qr-item">Item</Label>
                      <Select value={itemId || 'none'} onValueChange={(v) => setItemId(v === 'none' ? '' : v)}>
                        <SelectTrigger id="qr-item" aria-label="Item"><SelectValue placeholder="Escolha o item" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{itens.length ? 'Escolha o item...' : `Nenhum ${T.rotulo.toLowerCase()} cadastrado`}</SelectItem>
                          {itens.map((i) => <SelectItem key={i.id} value={i.id}>{[T.codigo(i), T.nome(i)].filter(Boolean).join(' · ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-md flex flex-col items-center justify-center p-8 min-h-[400px]">
                  {item ? (
                    <div className="text-center space-y-4 w-full">
                      <div className="p-4 bg-white rounded-xl inline-block border-2 border-dashed border-gray-200">
                        <QrImagem texto={linkItem} tamanho={200} onPronto={setQrUrl} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{T.nome(item)}</h3>
                        <p className="text-sm text-muted-foreground">{[T.rotulo, T.codigo(item)].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="flex gap-3 justify-center w-full">
                        <Button variant="outline" className="flex-1" disabled={!qrUrl} asChild>
                          <a href={qrUrl} download={`qrcode-${(T.codigo(item) || item.id).replace(/\W+/g, '-')}.png`}><Download className="w-4 h-4 mr-2" />Salvar PNG</a>
                        </Button>
                        <Button className="flex-1" disabled={!qrUrl} onClick={() => imprimirEtiqueta(qrUrl, T.nome(item), [T.rotulo, T.codigo(item)].filter(Boolean).join(' · '))}>
                          <Printer className="w-4 h-4 mr-2" />Imprimir
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground flex flex-col items-center opacity-50">
                      <QrCode className="w-24 h-24 mb-4" />
                      <p>Escolha um item para ver a etiqueta</p>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scan">
              <Card className="shadow-md max-w-2xl mx-auto">
                <CardHeader className="text-center border-b bg-muted/30">
                  <CardTitle className="text-xl">Ler etiqueta</CardTitle>
                  <CardDescription>Aponte a câmera para o QR Code do item ou para o código de barras da embalagem</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!lido ? (
                    <div className="rounded-xl overflow-hidden border-2 border-primary/20 bg-black/5"><div id="qr-reader" className="w-full" /></div>
                  ) : lido.erro ? (
                    <div className="text-center py-10 space-y-4">
                      <p className="font-semibold text-red-700">{lido.erro}</p>
                      <Button onClick={() => setLido(null)}>Ler outro</Button>
                    </div>
                  ) : (
                    <div className="py-6 space-y-4" data-testid="item-lido">
                      {(() => {
                        const t = TIPOS[lido.tipo];
                        const Icone = t.icone;
                        return (
                          <>
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-primary/10 text-primary rounded-lg"><Icone className="w-8 h-8" /></div>
                              <div>
                                <p className="text-xs uppercase text-muted-foreground">{t.rotulo}{t.codigo(lido.rec) ? ` · ${t.codigo(lido.rec)}` : ''}</p>
                                <h3 className="text-2xl font-bold">{t.nome(lido.rec)}</h3>
                              </div>
                            </div>
                            <ul className="text-sm space-y-1">{detalhes(lido.tipo, lido.rec).filter(Boolean).map((d) => <li key={d}>{d}</li>)}</ul>
                            <div className="flex flex-wrap gap-3 pt-2">
                              <Button asChild variant="outline"><Link to={t.pagina}><ExternalLink className="w-4 h-4 mr-2" />Abrir {t.rotulo === 'EPI' ? 'EPIs' : `${t.rotulo.toLowerCase()}s`}</Link></Button>
                              <Button onClick={() => setLido(null)}><ScanLine className="w-4 h-4 mr-2" />Ler outro</Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="track">
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-xl">Histórico de leituras</CardTitle>
                  <CardDescription>As últimas etiquetas lidas na empresa</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {historico.length === 0 ? (
                    <p className="text-center py-12 text-muted-foreground">Nenhuma leitura ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {historico.map((h) => {
                        const Icone = h.item_tipo === 'EPI' ? HardHat : h.item_tipo === 'Equipamento' ? Wrench : Box;
                        return (
                          <div key={h.id} className="flex items-start gap-4 p-3 rounded-xl bg-card border">
                            <div className="p-2 bg-primary/10 text-primary rounded-lg"><Icone className="w-5 h-5" /></div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start gap-2">
                                <p className="font-semibold">{h.qrcode_id || h.item_tipo}</p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(h.created.replace(' ', 'T')).toLocaleString('pt-BR')}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{h.item_tipo} · lido por {h.expand?.usuario_id?.name || h.expand?.usuario_id?.email || '—'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
};

export default QRCodeModule;
