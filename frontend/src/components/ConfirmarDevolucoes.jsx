import React, { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { auditLog, AUDIT_ACTIONS } from '@/lib/auditLogger.js';

// "Devoluções para confirmar" (pedido do Diego, 03/11/2026): o funcionário
// informa no app que está devolvendo; aqui a gestão do estoque confirma que o
// material chegou (ou chegou menos / recusa). Só na confirmação o saldo dele
// é debitado e o estoque creditado (pb_hooks/devolucao-funcionario.pb.js).
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const ConfirmarDevolucoes = ({ companyId, obras = [], onResolvido }) => {
  const [lista, setLista] = useState([]);
  const [sel, setSel] = useState(null);
  const [acao, setAcao] = useState('confirmar');
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(() => {
    if (!companyId) return;
    pb.collection('movimentacoes').getFullList({
      filter: `company_id = "${companyId}" && tipo = "Devolução de Funcionário" && aceite_status = "Aguardando"`,
      sort: 'created', expand: 'material_id,funcionario_id,estoque_obra_id', $autoCancel: false,
    }).then(setLista).catch(() => setLista([]));
  }, [companyId]);
  useEffect(() => { carregar(); }, [carregar]);

  const abrir = (m, a) => { setSel(m); setAcao(a); setQtd(''); setMotivo(''); setDestino(m.estoque_obra_id || 'geral'); };

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await pb.send('/api/custom/devolucao/confirmar', {
        method: 'POST', $autoCancel: false,
        body: { movimentacao_id: sel.id, acao, quantidade_recebida: Number(qtd || 0), motivo: motivo.trim(), estoque_obra_id: destino === 'geral' ? '' : destino },
      });
      const nome = sel.expand?.funcionario_id?.nome || 'funcionário';
      toast.success(r.status === 'Recusado' ? `Devolução recusada. O material continua no saldo de ${nome}.`
        : `Devolução confirmada: ${fmt(r.recebido)} ${sel.unidade || ''} voltaram ao estoque e saíram do saldo de ${nome}.`, { duration: 9000 });
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, 'Estoque', `Devolução de ${nome} (${sel.expand?.material_id?.name || ''}): ${r.status}${motivo.trim() ? ` — ${motivo.trim()}` : ''}`);
      setSel(null);
      carregar();
      onResolvido?.();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar a confirmação.'));
    } finally {
      setEnviando(false);
    }
  };

  if (!lista.length) return null;
  return (
    <>
      <Card className="mb-6 border-green-600/40" data-testid="devolucoes-confirmar">
        <CardContent className="p-4 space-y-2">
          <p className="font-semibold">Devoluções para confirmar ({lista.length})</p>
          <p className="text-xs text-muted-foreground">O funcionário informou a devolução. Confirme quando o material chegar: só então sai do saldo dele e volta ao estoque.</p>
          {lista.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2 text-sm">
              <div>
                <strong>{m.expand?.funcionario_id?.nome || 'Funcionário'}</strong> devolvendo {fmt(m.quantidade)} {m.unidade || m.expand?.material_id?.unit || ''} de <strong>{m.expand?.material_id?.name || 'material'}</strong>
                <span className="text-muted-foreground"> · volta para {m.expand?.estoque_obra_id?.nome ? `o estoque da obra ${m.expand.estoque_obra_id.nome}` : 'o estoque geral'}</span>
                {m.observacoes && <span className="text-muted-foreground"> · "{m.observacoes}"</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => abrir(m, 'confirmar')}>Confirmar recebimento</Button>
                <Button size="sm" variant="outline" onClick={() => abrir(m, 'diferenca')}>Chegou menos</Button>
                <Button size="sm" variant="outline" onClick={() => abrir(m, 'recusar')}>Recusar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) setSel(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acao === 'confirmar' ? 'Confirmar recebimento da devolução' : acao === 'diferenca' ? 'Chegou menos' : 'Recusar devolução'}</DialogTitle>
          </DialogHeader>
          {sel && (
            <div className="space-y-4">
              <p className="text-sm">{sel.expand?.funcionario_id?.nome} informou: <strong>{fmt(sel.quantidade)} {sel.unidade || ''} de {sel.expand?.material_id?.name}</strong></p>
              {acao === 'diferenca' && (
                <div className="space-y-2">
                  <Label htmlFor="dev_conf_qtd">Quanto chegou de fato? *</Label>
                  <Input id="dev_conf_qtd" type="number" inputMode="decimal" min="0" step="any" value={qtd} onChange={(e) => setQtd(e.target.value)} />
                </div>
              )}
              {acao !== 'confirmar' && (
                <div className="space-y-2">
                  <Label htmlFor="dev_conf_motivo">{acao === 'recusar' ? 'Motivo da recusa *' : 'O que aconteceu? *'}</Label>
                  <Textarea id="dev_conf_motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
              )}
              {acao !== 'recusar' && (
                <div className="space-y-2">
                  <Label htmlFor="dev_conf_destino">Volta para</Label>
                  <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger id="dev_conf_destino"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Estoque geral (almoxarifado)</SelectItem>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>Estoque da obra {o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSel(null)}>Voltar</Button>
                <Button disabled={enviando || (acao !== 'confirmar' && !motivo.trim()) || (acao === 'diferenca' && !(Number(qtd) > 0))}
                  onClick={enviar}>{acao === 'recusar' ? 'Recusar' : 'Confirmar'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConfirmarDevolucoes;
