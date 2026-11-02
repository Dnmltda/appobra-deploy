import React, { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import FotoRetirada from '@/components/FotoRetirada.jsx';
import { mensagemErro } from '@/lib/erros.js';
import { auditLog, AUDIT_ACTIONS } from '@/lib/auditLogger.js';

// "Aguardando sua confirmação" (pedido do Diego, 02/11/2026): material que o
// estoque mandou para mim só entra no meu saldo depois que eu confirmo o que
// chegou — aceitar, recebi menos (quanto chegou) ou recusar. Aceitar pede a
// foto do material. Regras no servidor: pb_hooks/aceite-retirada.pb.js.
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const AceiteRetirada = ({ onRespondido }) => {
  const { currentUser } = useAuth();
  const [itens, setItens] = useState([]);
  const [sel, setSel] = useState(null);
  const [acao, setAcao] = useState('aceitar');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [foto, setFoto] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    if (!currentUser?.funcionario_id) return;
    pb.send('/api/custom/retirada/pendentes', { method: 'GET', $autoCancel: false })
      .then((r) => setItens(r.items || [])).catch(() => setItens([]));
  }, [currentUser?.funcionario_id]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (item, a) => { setSel(item); setAcao(a); setQtd(''); setMotivo(''); setFoto(null); };

  const responder = async () => {
    const fd = new FormData();
    fd.append('movimentacao_id', sel.id);
    fd.append('acao', acao);
    if (acao === 'diferenca') fd.append('quantidade_recebida', qtd);
    if (motivo.trim()) fd.append('motivo', motivo.trim());
    if (foto) fd.append('foto', foto);
    setEnviando(true);
    try {
      const r = await pb.send('/api/custom/retirada/responder', { method: 'POST', body: fd, $autoCancel: false });
      toast.success(r.status === 'Recusado' ? 'Recusa registrada. A gestão foi avisada.'
        : r.status === 'Aceito' ? `Recebimento confirmado: ${fmt(r.recebido)} ${sel.unidade} de ${sel.material} no seu saldo.`
          : `Registrado: chegou ${fmt(r.recebido)} de ${fmt(sel.quantidade)} ${sel.unidade}. A gestão foi avisada da diferença.`, { duration: 9000 });
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, 'Saldo por Funcionário', `Envio ${sel.numero} (${sel.material}): ${r.status}${r.status !== 'Aceito' ? ` — ${motivo.trim()}` : ''}`);
      setSel(null);
      carregar();
      onRespondido?.();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar a resposta.'));
    } finally {
      setEnviando(false);
    }
  };

  if (!itens.length) return null;
  return (
    <>
      <Card className="mb-6 border-ouro/60" data-testid="aguardando-confirmacao">
        <CardContent className="p-4 space-y-3">
          <p className="font-semibold flex items-center gap-2"><PackageCheck className="w-5 h-5 text-ouro" />Aguardando sua confirmação ({itens.length})</p>
          <p className="text-sm text-muted-foreground">Confira o material que chegou. Ele só entra no seu saldo depois que você confirmar.</p>
          {itens.map((i) => (
            <div key={i.id} className="border rounded-md p-3 space-y-2">
              <p className="text-sm"><strong>{fmt(i.quantidade)} {i.unidade} de {i.material}</strong>
                <span className="text-muted-foreground"> · enviado por {i.enviado_por || 'estoque'} · {i.numero}</span></p>
              {i.observacoes && <p className="text-xs text-muted-foreground">{i.observacoes}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button size="sm" onClick={() => abrir(i, 'aceitar')}>Aceitar</Button>
                <Button size="sm" variant="outline" onClick={() => abrir(i, 'diferenca')}>Recebi menos</Button>
                <Button size="sm" variant="outline" onClick={() => abrir(i, 'recusar')}>Recusar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) setSel(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{acao === 'aceitar' ? 'Confirmar recebimento' : acao === 'diferenca' ? 'Recebi menos' : 'Recusar envio'}</DialogTitle>
          </DialogHeader>
          {sel && (
            <div className="space-y-4">
              <p className="text-sm">Enviado: <strong>{fmt(sel.quantidade)} {sel.unidade} de {sel.material}</strong></p>
              {acao === 'diferenca' && (
                <div className="space-y-2">
                  <Label htmlFor="aceite_qtd">Quanto chegou de fato? *</Label>
                  <Input id="aceite_qtd" type="number" inputMode="decimal" min="0" step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
                </div>
              )}
              {acao !== 'aceitar' && (
                <div className="space-y-2">
                  <Label htmlFor="aceite_motivo">{acao === 'recusar' ? 'Motivo da recusa *' : 'O que aconteceu? *'}</Label>
                  <Textarea id="aceite_motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
              )}
              {acao !== 'recusar' && <FotoRetirada rotulo="Foto do material que chegou" onFoto={setFoto} />}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSel(null)}>Voltar</Button>
                <Button disabled={enviando || (acao !== 'recusar' && !foto) || (acao !== 'aceitar' && !motivo.trim()) || (acao === 'diferenca' && !(Number(qtd) > 0))}
                  onClick={responder}>{acao === 'recusar' ? 'Recusar' : 'Confirmar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AceiteRetirada;
