import React, { useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// "Para qual andar/unidade é esse material?" (opcional). Só aparece quando a
// obra escolhida tem estrutura (Prédio ou Casa); em branco tudo funciona como
// antes. O servidor confere que a unidade é da obra (estrutura-obra.pb.js).
const SeletorUnidade = ({ obraId, value, onChange, id = 'unidade_id' }) => {
  const { language } = useLanguage();
  const [unidades, setUnidades] = useState([]);

  useEffect(() => {
    let ativo = true;
    if (!obraId) { setUnidades([]); return undefined; }
    pb.collection('obras_unidades').getFullList({
      filter: `obra_id = "${obraId}" && ativo = true`, expand: 'andar_id', sort: 'ordem', $autoCancel: false,
    }).then((l) => {
      if (!ativo) return;
      const nome = (u) => (u.expand?.andar_id ? `${u.expand.andar_id.nome} · ${u.nome}` : u.nome);
      const ordem = (u) => (u.expand?.andar_id?.ordem || 0) * 1000 + (u.ordem || 0);
      setUnidades(l.sort((a, b) => ordem(a) - ordem(b)).map((u) => ({ id: u.id, nome: nome(u) })));
    }).catch(() => { if (ativo) setUnidades([]); });
    return () => { ativo = false; };
  }, [obraId]);

  // Trocou de obra e a unidade escolhida não é dela: limpa.
  useEffect(() => {
    if (value && unidades.length && !unidades.some((u) => u.id === value)) onChange('');
  }, [unidades]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unidades.length) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t('est_unidadeOpcional', language)}</Label>
      <Select value={value || 'nenhuma'} onValueChange={(v) => onChange(v === 'nenhuma' ? '' : v)}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhuma">{t('est_nenhuma', language)}</SelectItem>
          {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SeletorUnidade;
