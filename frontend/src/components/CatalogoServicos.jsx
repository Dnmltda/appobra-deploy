import React, { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListChecks, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro, falhaAoCarregar } from '@/lib/erros.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';

// Catálogo de serviços da obra (Configurações → "Serviços da obra"; só o
// Administrador, regra no servidor: estrutura-obra.pb.js). Desativar não
// apaga nada: os serviços já lançados guardam o nome que tinham.
const CatalogoServicos = () => {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  const tt = (k) => t(k, language);
  const [lista, setLista] = useState([]);
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => {
    pb.collection('servicos_padrao').getFullList({ sort: 'ordem,nome', $autoCancel: false })
      .then(setLista).catch(falhaAoCarregar(tt('est_catalogo')));
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (fn, texto) => {
    setOcupado(true);
    try {
      await fn();
      auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULES.SETTINGS || 'Configurações', texto);
      toast.success(tt('est_salvo'));
      carregar();
    } catch (err) {
      toast.error(mensagemErro(err, tt('est_erroSalvar')));
    } finally {
      setOcupado(false);
    }
  };

  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    salvar(() => pb.collection('servicos_padrao').create({
      company_id: currentUser.company_id, nome, ativo: true, ordem: lista.length + 1,
    }, { $autoCancel: false }), `Serviço da obra incluído: ${nome}`).then(() => setNovo(''));
  };

  const renomear = (s) => {
    const nome = window.prompt(tt('est_renomear'), s.nome);
    if (!nome || !nome.trim() || nome.trim() === s.nome) return;
    salvar(() => pb.collection('servicos_padrao').update(s.id, { nome: nome.trim() }, { $autoCancel: false }), `Serviço da obra renomeado: ${s.nome} → ${nome.trim()}`);
  };

  const alternar = (s) => salvar(() => pb.collection('servicos_padrao').update(s.id, { ativo: !s.ativo }, { $autoCancel: false }),
    `Serviço da obra ${s.ativo ? 'desativado' : 'ativado'}: ${s.nome}`);

  return (
    <Card className="shadow-sm border-border bg-card">
      <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg"><ListChecks className="h-5 w-5 text-primary" /></div>
        <CardTitle className="text-xl text-primary">{tt('est_catalogo')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-muted-foreground">{tt('est_catalogoDesc')}</p>
        <ul className="divide-y rounded-md border" data-testid="catalogo-servicos">
          {lista.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 p-3">
              <span className={s.ativo ? 'font-medium' : 'text-muted-foreground line-through'}>{s.nome}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" title={tt('est_renomear')} disabled={ocupado} onClick={() => renomear(s)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" disabled={ocupado} onClick={() => alternar(s)}>{s.ativo ? tt('est_desativar') : tt('est_ativar')}</Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={tt('est_novoServico')} aria-label={tt('est_novoServico')} />
          <Button disabled={ocupado || !novo.trim()} onClick={adicionar}><Plus className="w-4 h-4 mr-1" />{tt('est_adicionar')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CatalogoServicos;
