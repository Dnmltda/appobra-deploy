import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { FileDown, ArrowLeftRight, PlusCircle, Inbox, ShieldAlert } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

// "Movimentações do dia" (pedido do Diego, 25/10/2026): o que a pessoa
// movimentou, cadastrou, o que mandaram para ela e as tentativas barradas.
// Aba "Semana" (segunda até hoje) e o PDF da semana para baixar. Os dados vêm
// do servidor (pb_hooks/avisos.pb.js); nada aqui pode ser alterado.

const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const segundaBR = () => {
  const d = new Date(`${hojeBR()}T12:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // segunda = 0
  return new Date(d.getTime() - dia * 86400000).toISOString().slice(0, 10);
};
const br = (iso) => iso.split('-').reverse().join('/');

const BLOCOS = [
  { chave: 'movimentei', titulo: 'O que eu movimentei', icone: ArrowLeftRight },
  { chave: 'cadastrei', titulo: 'O que eu cadastrei', icone: PlusCircle },
  { chave: 'recebi', titulo: 'O que mandaram para mim', icone: Inbox },
  { chave: 'tentativas', titulo: 'Tentativas barradas', icone: ShieldAlert, alerta: true },
];

async function baixarPdf(dados, nome, empresa) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(10, 31, 77);
  doc.text('Movimentações da semana', 14, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80);
  doc.text(`${br(dados.de)} a ${br(dados.ate)} · ${nome}${empresa ? ` · ${empresa}` : ''}`, 14, y); y += 4;
  doc.setDrawColor(208, 156, 38); doc.setLineWidth(0.8); doc.line(14, y, 196, y); y += 8;
  BLOCOS.forEach((b) => {
    const itens = dados[b.chave] || [];
    if (y > 270) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.setTextColor(...(b.alerta ? [185, 28, 28] : [30, 64, 175]));
    doc.text(`${b.titulo} (${itens.length})`, 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(10, 31, 77);
    if (!itens.length) { doc.setTextColor(120); doc.text('Nada neste período.', 16, y); y += 7; return; }
    itens.forEach((i) => {
      const linhas = doc.splitTextToSize(`${br(i.data)} ${i.hora} · ${i.texto}${i.quem ? ` (login de ${i.quem})` : ''}`, 178);
      if (y + linhas.length * 4.5 > 285) { doc.addPage(); y = 18; }
      doc.text(linhas, 16, y); y += linhas.length * 4.5 + 1.5;
    });
    y += 4;
  });
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text(`Gerado pelo APP OBRA by DNM&LTDA em ${new Date().toLocaleString('pt-BR')} · Registros fixos: nada desta lista pode ser alterado ou apagado.`, 14, 292);
  doc.save(`movimentacoes-${dados.de}-a-${dados.ate}.pdf`);
}

const MinhasMovimentacoesPage = () => {
  const { currentUser } = useAuth();
  const [aba, setAba] = useState('hoje');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setDados(null); setErro(false);
    const de = aba === 'hoje' ? hojeBR() : segundaBR();
    pb.send(`/api/custom/minhas-movimentacoes?de=${de}&ate=${hojeBR()}`, { $autoCancel: false })
      .then((r) => { if (vivo) setDados(r); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [aba]);

  const nome = currentUser?.name || currentUser?.email || '';
  const pdf = async () => {
    try {
      const r = aba === 'semana' && dados ? dados
        : await pb.send(`/api/custom/minhas-movimentacoes?de=${segundaBR()}&ate=${hojeBR()}`, { $autoCancel: false });
      await baixarPdf(r, nome, currentUser?.expand?.company_id?.name || '');
    } catch (_) {
      toast.error('Não foi possível gerar o PDF agora. Tente de novo.');
    }
  };

  return (
    <>
      <Helmet><title>Movimentações do dia - APP OBRA</title></Helmet>
      <Header />
      <main className="py-6 sm:py-8">
        <div className="app-container max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-marinho">Movimentações do dia</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {aba === 'hoje' ? `Hoje, ${br(hojeBR())}` : `Semana: ${br(segundaBR())} a ${br(hojeBR())}`} · {nome}
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[['hoje', 'Hoje'], ['semana', 'Semana']].map(([v, t]) => (
              <Button key={v} type="button" variant={aba === v ? 'default' : 'outline'} className={aba === v ? 'bg-royal text-white hover:bg-royal' : ''} onClick={() => setAba(v)}>{t}</Button>
            ))}
          </div>
          {erro ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Não foi possível carregar agora. Verifique a internet e tente de novo.</p>
          ) : !dados ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : (
            <div className="space-y-3">
              {BLOCOS.map((b) => {
                const itens = dados[b.chave] || [];
                const Icone = b.icone;
                return (
                  <Card key={b.chave} className={b.alerta && itens.length ? 'border-red-500' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className={`font-semibold flex items-center gap-2 ${b.alerta && itens.length ? 'text-red-700' : 'text-marinho'}`}>
                          <Icone className="w-4 h-4" aria-hidden="true" />{b.titulo}
                        </h2>
                        <span className="text-xs font-semibold bg-creme rounded-full px-2 py-0.5">{itens.length}</span>
                      </div>
                      {itens.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nada {aba === 'hoje' ? 'hoje' : 'nesta semana'}.</p>
                      ) : (
                        <ul className="divide-y">
                          {itens.map((i, k) => (
                            <li key={k} className="flex justify-between gap-3 py-1.5 text-sm">
                              <span>{i.texto}{i.quem ? <span className="text-muted-foreground"> (login de {i.quem})</span> : null}</span>
                              <span className="text-muted-foreground shrink-0">{aba === 'semana' ? `${br(i.data).slice(0, 5)} ` : ''}{i.hora}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              <Button type="button" className="w-full h-11 gap-2" onClick={pdf}>
                <FileDown className="w-4 h-4" aria-hidden="true" /> Baixar PDF da semana
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default MinhasMovimentacoesPage;
