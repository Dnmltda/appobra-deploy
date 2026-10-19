import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, FileSpreadsheet, Printer, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const ReportsPage = () => {
  const { currentUser } = useAuth();
  const [reportType, setReportType] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState('');

  const reportOptions = [
    'Funcionários', 'Obras', 'Compras', 'Receitas', 'Despesas', 'Treinamentos', 'Veículos'
  ];

  const fetchDataForReport = async () => {
    if (!currentUser?.company_id) throw new Error("Empresa não vinculada.");
    const filter = `company_id="${currentUser.company_id}"`;
    const obraFilter = `obraId.company_id="${currentUser.company_id}"`;
    let rawData = [];

    switch (reportType) {
      case 'Funcionários':
        rawData = await pb.collection('funcionarios').getFullList({ filter, $autoCancel: false });
        return rawData.map(r => ({ ID: r.matricula, Nome: r.nome_completo, Cargo: r.cargo, Status: r.status }));
      case 'Obras':
        rawData = await pb.collection('obras').getFullList({ filter, $autoCancel: false });
        return rawData.map(r => ({ Obra: r.nome, Status: r.status, Inicio: r.dataInicio, Fim: r.dataFim }));
      case 'Compras':
        rawData = await pb.collection('compras').getFullList({ filter, $autoCancel: false });
        return rawData.map(r => ({ Numero: r.numero, Descricao: r.descricao, Valor: r.valor, Status: r.status }));
      case 'Receitas':
        rawData = await pb.collection('receitas').getFullList({ filter: obraFilter, $autoCancel: false });
        return rawData.map(r => ({ Descricao: r.descricao, Valor: r.valor, Data: r.data, Status: r.status }));
      case 'Despesas':
        rawData = await pb.collection('despesas').getFullList({ filter: obraFilter, $autoCancel: false });
        return rawData.map(r => ({ Descricao: r.descricao, Valor: r.valor, Data: r.data, Status: r.status }));
      case 'Treinamentos':
        rawData = await pb.collection('treinamentos').getFullList({ filter, $autoCancel: false });
        return rawData.map(r => ({ Curso: r.curso, Validade: r.dataValidade, Status: r.status }));
      case 'Veículos':
        rawData = await pb.collection('veiculos').getFullList({ filter, $autoCancel: false });
        return rawData.map(r => ({ Placa: r.placa, Marca: r.marca, Modelo: r.modelo, Status: r.status }));
      default:
        return [];
    }
  };

  const handleExport = async (format) => {
    if (!currentUser || !currentUser.company_id) {
      toast.error('Acesso negado. Empresa não vinculada.');
      return;
    }
    if (!reportType) {
      toast.error('Selecione um tipo de relatório primeiro');
      return;
    }

    setLoading(true);
    setLoadingType(format);

    try {
      const dataToExport = await fetchDataForReport();
      
      if (dataToExport.length === 0) {
        toast.warning('Nenhum dado encontrado para este relatório.');
        setLoading(false);
        setLoadingType('');
        return;
      }

      try {
        await pb.collection('relatorios_exportados').create({
          tipo_relatorio: reportType,
          formato: format === 'print' ? 'PDF' : format.toUpperCase(),
          usuario_id: currentUser.id,
          company_id: currentUser.company_id
        }, { $autoCancel: false });
      } catch (e) {
        console.warn('Could not register export log', e);
      }

      if (format === 'pdf') {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text(`Relatório de ${reportType}`, 20, 20);
        doc.setFontSize(12);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 30);
        
        let y = 40;
        doc.setFontSize(10);
        dataToExport.forEach((row) => {
          if(y > 280) { doc.addPage(); y = 20; }
          const textLine = Object.entries(row).map(([k,v]) => `${k}: ${v}`).join(' | ');
          doc.text(textLine, 20, y);
          y += 10;
        });
        
        doc.save(`relatorio_${reportType.toLowerCase()}_${Date.now()}.pdf`);
        toast.success('PDF gerado com sucesso');
      } 
      else if (format === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, reportType);
        XLSX.writeFile(workbook, `relatorio_${reportType.toLowerCase()}_${Date.now()}.xlsx`);
        toast.success('Planilha gerada com sucesso');
      }
      else if (format === 'csv') {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_${reportType.toLowerCase()}_${Date.now()}.csv`;
        link.click();
        toast.success('CSV gerado com sucesso');
      }
      else if (format === 'print') {
        window.print();
        toast.success('Preparando impressão...');
      }

    } catch (error) {
      toast.error(`Erro ao gerar ${format.toUpperCase()}: ${error.message}`);
    } finally {
      setLoading(false);
      setLoadingType('');
    }
  };

  return (
    <>
      <Helmet><title>Relatórios - Exportação</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Central de Relatórios
            </h1>
            <p className="text-muted-foreground mt-2">Geração e exportação de dados do sistema</p>
          </div>

          <Card className="shadow-lg border-border">
            <CardHeader className="bg-card rounded-t-xl border-b pb-6">
              <CardTitle className="text-xl text-primary">Configurar Relatório</CardTitle>
              <CardDescription>Selecione o módulo e o formato desejado para exportação</CardDescription>
            </CardHeader>
            <CardContent className="pt-8">
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">
                    Módulo de Dados
                  </Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="h-12 text-base bg-background">
                      <SelectValue placeholder="Selecione o tipo de relatório..." />
                    </SelectTrigger>
                    <SelectContent>
                      {reportOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-6 border-t">
                  <Label className="text-base font-semibold text-foreground mb-4 block">
                    Formato de Exportação
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleExport('pdf')} disabled={loading}>
                      {loading && loadingType === 'pdf' ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileDown className="w-8 h-8 text-red-600" />}
                      <span className="font-semibold">PDF (.pdf)</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleExport('excel')} disabled={loading}>
                      {loading && loadingType === 'excel' ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileSpreadsheet className="w-8 h-8 text-green-600" />}
                      <span className="font-semibold">Excel (.xlsx)</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleExport('csv')} disabled={loading}>
                      {loading && loadingType === 'csv' ? <Loader2 className="w-8 h-8 animate-spin" /> : <FileText className="w-8 h-8 text-blue-600" />}
                      <span className="font-semibold">CSV (.csv)</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2" onClick={() => handleExport('print')} disabled={loading}>
                      {loading && loadingType === 'print' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Printer className="w-8 h-8 text-gray-600" />}
                      <span className="font-semibold">Imprimir</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default ReportsPage;
