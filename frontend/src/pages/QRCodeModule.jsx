import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, ScanLine, History, Download, Printer, MapPin, HardHat, Wrench, Box } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';
import { Html5QrcodeScanner } from 'html5-qrcode';

const QRCodeModule = () => {
  const [activeTab, setActiveTab] = useState('generate');
  const [itemType, setItemType] = useState('Materiais');
  const [itemInfo, setItemInfo] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [history, setHistory] = useState([]);
  
  const scannerRef = useRef(null);
  const isScannerInitialized = useRef(false);

  useEffect(() => {
    if (activeTab === 'scan' && !isScannerInitialized.current) {
      // Delay initialization slightly to ensure DOM element is ready
      setTimeout(() => {
        try {
          const scanner = new Html5QrcodeScanner("qr-reader", { 
            qrbox: { width: 250, height: 250 }, 
            fps: 10,
            rememberLastUsedCamera: true
          });
          
          scanner.render((decodedText) => {
            setScanResult(decodedText);
            handleSuccessfulScan(decodedText);
            scanner.clear();
            isScannerInitialized.current = false;
          }, (error) => {
            // Ignore continuous scan errors (normal behavior)
          });
          
          scannerRef.current = scanner;
          isScannerInitialized.current = true;
        } catch (err) {
          console.error("Scanner initialization error:", err);
        }
      }, 300);
    }

    return () => {
      if (scannerRef.current && isScannerInitialized.current) {
        try {
          scannerRef.current.clear();
        } catch (e) { console.error("Error clearing scanner", e); }
        isScannerInitialized.current = false;
      }
    };
  }, [activeTab]);

  const handleGenerate = () => {
    if (!itemInfo) {
      toast.error('Informe os dados do item');
      return;
    }
    const uniqueId = `${itemType.substring(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const qrData = JSON.stringify({ type: itemType, info: itemInfo, id: uniqueId });
    setGeneratedCode(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`);
    toast.success('QR Code gerado com sucesso');
  };

  const handleSuccessfulScan = async (text) => {
    try {
      const data = JSON.parse(text);
      toast.success(`Item escaneado: ${data.type} - ${data.info}`);
      
      // Log to database
      const log = await pb.collection('qrcode_leituras').create({
        qrcode_id: data.id,
        item_tipo: data.type === 'EPIs' ? 'EPI' : data.type === 'Equipamentos' ? 'Equipamento' : 'Material',
        usuario_id: pb.authStore.model?.id,
        localizacao: 'Canteiro Central',
        acao: 'Leitura'
      }, { $autoCancel: false });
      
      setHistory(prev => [log, ...prev].slice(0, 10));
    } catch (e) {
      toast.warning(`Leitura realizada (formato não padrão): ${text.substring(0, 30)}...`);
    }
  };

  return (
    <>
      <Helmet><title>QR Code - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <QrCode className="w-8 h-8" />
              Módulo QR Code
            </h1>
            <p className="text-muted-foreground mt-2">Geração, leitura e rastreamento de itens e ativos</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-14 rounded-xl p-1 bg-card border shadow-sm">
              <TabsTrigger value="generate" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><QrCode className="w-4 h-4 mr-2"/> Gerar</TabsTrigger>
              <TabsTrigger value="scan" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><ScanLine className="w-4 h-4 mr-2"/> Escanear</TabsTrigger>
              <TabsTrigger value="track" className="rounded-lg font-semibold text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><History className="w-4 h-4 mr-2"/> Rastreio</TabsTrigger>
            </TabsList>

            <TabsContent value="generate">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="shadow-md border-border">
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-xl">Dados do Item</CardTitle>
                    <CardDescription>Preencha os dados para gerar a etiqueta</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Categoria do Item</Label>
                      <Select value={itemType} onValueChange={setItemType}>
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Materiais"><div className="flex items-center"><Box className="w-4 h-4 mr-2"/> Materiais</div></SelectItem>
                          <SelectItem value="Equipamentos"><div className="flex items-center"><Wrench className="w-4 h-4 mr-2"/> Equipamentos</div></SelectItem>
                          <SelectItem value="EPIs"><div className="flex items-center"><HardHat className="w-4 h-4 mr-2"/> EPIs</div></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">Identificação / Nome</Label>
                      <Input 
                        placeholder="Ex: Furadeira Bosch 800W ou Lote Cimento..." 
                        value={itemInfo}
                        onChange={(e) => setItemInfo(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <Button onClick={handleGenerate} className="w-full h-12 text-base mt-2 bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
                      Gerar QR Code
                    </Button>
                  </CardContent>
                </Card>

                <Card className="shadow-md border-border flex flex-col items-center justify-center p-8 min-h-[400px]">
                  {generatedCode ? (
                    <div className="text-center space-y-6 w-full">
                      <div className="p-4 bg-white rounded-xl shadow-inner inline-block border-2 border-dashed border-gray-200">
                        <img src={generatedCode} alt="Generated QR" className="w-48 h-48 mx-auto" crossOrigin="anonymous" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{itemInfo}</h3>
                        <p className="text-sm text-muted-foreground uppercase tracking-widest">{itemType}</p>
                      </div>
                      <div className="flex gap-3 justify-center w-full">
                        <Button variant="outline" className="flex-1" onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedCode;
                          link.download = `qrcode_${itemType}_${Date.now()}.png`;
                          link.click();
                        }}>
                          <Download className="w-4 h-4 mr-2" /> Salvar PNG
                        </Button>
                        <Button className="flex-1" onClick={() => {
                          const win = window.open('');
                          win.document.write(`<div style="text-align:center;font-family:sans-serif;"><img src="${generatedCode}" width="200"/><br/><h2>${itemInfo}</h2><p>${itemType}</p></div>`);
                          win.document.close();
                          win.focus();
                          setTimeout(() => { win.print(); win.close(); }, 500);
                        }}>
                          <Printer className="w-4 h-4 mr-2" /> Imprimir
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground flex flex-col items-center opacity-50">
                      <QrCode className="w-24 h-24 mb-4" />
                      <p>O QR Code gerado aparecerá aqui</p>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="scan">
              <Card className="shadow-md border-border max-w-2xl mx-auto">
                <CardHeader className="text-center border-b bg-muted/30">
                  <CardTitle className="text-xl">Leitor de QR Code</CardTitle>
                  <CardDescription>Aponte a câmera para a etiqueta do item</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!scanResult ? (
                    <div className="rounded-xl overflow-hidden border-2 border-primary/20 bg-black/5">
                      <div id="qr-reader" className="w-full"></div>
                    </div>
                  ) : (
                    <div className="text-center py-12 space-y-6">
                      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ScanLine className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-bold text-primary">Leitura Bem-Sucedida!</h3>
                      <div className="p-4 bg-muted rounded-lg text-left max-w-sm mx-auto break-all font-mono text-sm">
                        {scanResult}
                      </div>
                      <div className="flex gap-4 justify-center pt-4">
                        <Button onClick={() => {
                          setScanResult(null);
                          setActiveTab('scan'); // trigger re-render to remount scanner
                        }} className="bg-primary text-primary-foreground">
                          Nova Leitura
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="track">
              <Card className="shadow-md border-border">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-xl">Histórico de Rastreamento</CardTitle>
                  <CardDescription>Últimas movimentações e leituras registradas</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {history.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center opacity-50">
                      <MapPin className="w-16 h-16 mb-4" />
                      <p>Nenhuma leitura registrada nesta sessão.</p>
                      <p className="text-sm">As leituras aparecerão aqui em tempo real.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-card border hover:shadow-md transition-shadow">
                          <div className="p-3 bg-primary/10 text-primary rounded-lg">
                            {log.item_tipo === 'EPI' ? <HardHat className="w-5 h-5"/> : 
                             log.item_tipo === 'Equipamento' ? <Wrench className="w-5 h-5"/> : <Box className="w-5 h-5"/>}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-foreground">ID: {log.qrcode_id}</h4>
                              <span className="text-xs font-medium px-2 py-1 bg-muted rounded-full">
                                {new Date(log.created).toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Local: <span className="font-medium text-foreground">{log.localizacao}</span> • 
                              Ação: <span className="font-medium text-foreground">{log.acao}</span>
                            </p>
                          </div>
                        </div>
                      ))}
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