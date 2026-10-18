import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FolderOpen, FileText, UploadCloud, Search, Download, Shield, Clock, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';

const DocumentsCentralPage = () => {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');
  
  const [formData, setFormData] = useState({
    nome: '', tipo: 'PDF', descricao: '', tags: '', acesso: 'Restrito', categoria: 'Projetos', data_vencimento: ''
  });
  const [arquivo, setArquivo] = useState(null);

  const categorias = ['Projetos', 'Contratos', 'Alvarás', 'RH', 'Financeiro', 'Diversos'];

  useEffect(() => {
    fetchData();
  }, [categoriaFiltro]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let filterStr = '';
      if (categoriaFiltro !== 'Todos') {
        filterStr = `categoria = "${categoriaFiltro}"`;
      }
      const records = await pb.collection('documentos_central').getFullList({ 
        filter: filterStr,
        sort: '-created', 
        expand: 'responsavel_id',
        $autoCancel: false 
      });
      setDocumentos(records);
    } catch (error) {
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!arquivo) {
      toast.error('Selecione um arquivo para upload');
      return;
    }
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      data.append('arquivo', arquivo);
      data.append('responsavel_id', pb.authStore.model?.id);
      data.append('versao', 1);

      await pb.collection('documentos_central').create(data, { $autoCancel: false });
      toast.success('Documento salvo com sucesso');
      setShowUploadModal(false);
      setArquivo(null);
      fetchData();
    } catch (error) {
      toast.error('Erro no upload do documento');
    }
  };

  const filteredDocs = documentos.filter(doc => 
    doc.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.tags?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Helmet><title>Central de Documentos - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
                <FolderOpen className="w-8 h-8" />
                Central de Documentos
              </h1>
              <p className="text-muted-foreground mt-2">Armazenamento seguro, versionamento e compartilhamento</p>
            </div>
            <Button onClick={() => setShowUploadModal(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold h-12 px-6">
              <UploadCloud className="w-5 h-5 mr-2" /> Novo Upload
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar / Tree View */}
            <Card className="shadow-sm border-border lg:col-span-1 h-fit">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <CardTitle className="text-lg">Categorias</CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1 mt-2">
                  <Button 
                    variant="ghost" 
                    className={`w-full justify-start ${categoriaFiltro === 'Todos' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
                    onClick={() => setCategoriaFiltro('Todos')}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" /> Todos os Arquivos
                  </Button>
                  {categorias.map(cat => (
                    <Button 
                      key={cat}
                      variant="ghost" 
                      className={`w-full justify-start ${categoriaFiltro === cat ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground'}`}
                      onClick={() => setCategoriaFiltro(cat)}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" /> {cat}
                    </Button>
                  ))}
                </div>
                
                <div className="mt-8 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground px-4 mb-2 uppercase tracking-wider">Alertas</h4>
                  <div className="px-4 py-3 bg-amber-50 rounded-lg text-amber-800 border border-amber-200 flex items-start gap-3">
                    <FileWarning className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-bold block">1 Documento a vencer</span>
                      Licença Ambiental - Obra Centro (Vence em 12 dias)
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Content List */}
            <Card className="shadow-sm border-border lg:col-span-3">
              <CardHeader className="bg-muted/30 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl">{categoriaFiltro === 'Todos' ? 'Todos os Arquivos' : categoriaFiltro}</CardTitle>
                  <CardDescription>{filteredDocs.length} documentos encontrados</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome ou tag..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-9 bg-background" 
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">Carregando documentos...</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center opacity-50">
                    <FolderOpen className="w-16 h-16 mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium text-foreground">Nenhum documento encontrado</p>
                    <p className="text-sm text-muted-foreground">Tente outra categoria ou termo de busca.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow>
                        <TableHead className="w-[300px]">Nome do Arquivo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocs.map(doc => (
                        <TableRow key={doc.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 text-primary rounded">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{doc.nome}</p>
                                <p className="text-xs text-muted-foreground">v{doc.versao} • {doc.tipo}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{doc.categoria}</TableCell>
                          <TableCell className="text-muted-foreground">{new Date(doc.created).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            {doc.acesso === 'Restrito' ? 
                              <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md w-fit"><Shield className="w-3 h-3 mr-1"/> Restrito</span> : 
                              <span className="flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-md w-fit">Público</span>
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" title="Histórico de Versões">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              {doc.arquivo && doc.arquivo.length > 0 && (
                                <Button variant="outline" size="sm" asChild className="hover:bg-primary hover:text-primary-foreground transition-colors">
                                  <a href={pb.files.getURL(doc, doc.arquivo[0])} target="_blank" rel="noreferrer" download>
                                    <Download className="w-4 h-4 mr-2" /> Baixar
                                  </a>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
            <DialogDescription>Adicione um novo arquivo à central (Máx 20MB)</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4 mt-4">
            
            <div className="p-8 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center cursor-pointer relative group">
              <UploadCloud className="w-12 h-12 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <p className="text-lg font-medium text-primary">Arraste arquivos ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-1">Suporta PDF, DOCX, DWG, Imagens</p>
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={e => {
                  setArquivo(e.target.files[0]);
                  if (!formData.nome) setFormData({...formData, nome: e.target.files[0]?.name.split('.')[0] || ''});
                }}
                required
              />
              {arquivo && (
                <div className="mt-4 p-2 bg-white rounded border border-border text-sm font-medium w-full text-center truncate">
                  {arquivo.name} ({(arquivo.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label className="font-bold">Nome do Documento *</Label>
                <Input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Ex: Projeto Estrutural Torre B" />
              </div>
              
              <div className="space-y-2 col-span-1">
                <Label className="font-bold">Categoria *</Label>
                <Select value={formData.categoria} onValueChange={v => setFormData({...formData, categoria: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-1">
                <Label className="font-bold">Nível de Acesso *</Label>
                <Select value={formData.acesso} onValueChange={v => setFormData({...formData, acesso: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Restrito">Restrito (Admin/Gestores)</SelectItem>
                    <SelectItem value="Público">Público (Toda a empresa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-1">
                <Label className="font-bold">Tipo Arquivo</Label>
                <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PDF">PDF</SelectItem>
                    <SelectItem value="DWG">Projeto (DWG/CAD)</SelectItem>
                    <SelectItem value="DOCX">Word (DOCX)</SelectItem>
                    <SelectItem value="Imagem">Imagem (JPG/PNG)</SelectItem>
                    <SelectItem value="Contrato">Contrato</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-1">
                <Label className="font-bold">Data de Vencimento</Label>
                <Input type="date" value={formData.data_vencimento} onChange={e => setFormData({...formData, data_vencimento: e.target.value})} />
                <p className="text-xs text-muted-foreground">Opcional (para licenças/alvarás)</p>
              </div>

              <div className="space-y-2 col-span-2">
                <Label className="font-bold">Tags</Label>
                <Input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="Ex: estrutura, fundação, aprovado (separado por vírgula)" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-8">Salvar Documento</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentsCentralPage;