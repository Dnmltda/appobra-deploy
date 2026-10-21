import pb from '@/lib/pocketbaseClient';

// Ficha de EPI (cautela) de um funcionário, em PDF: todos os EPIs que ele
// recebeu (data, EPI, CA, quantidade, devolução), com a assinatura e a foto
// de cada entrega e o termo de responsabilidade da NR-6, item 6.6.1, para
// imprimir e assinar. Pedido do Diego (lista do Easytool), 21/10/2026.

const dataBR = (d) => {
  if (!d) return '';
  const t = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('pt-BR');
};

// Foto protegida → data URL (o PDF precisa da imagem, não do link).
const fotoDataUrl = async (rec, campo, token) => {
  if (!rec?.[campo]) return '';
  try {
    const r = await fetch(pb.files.getURL(rec, rec[campo], { token, thumb: '160x160' }));
    if (!r.ok) return '';
    const blob = await r.blob();
    return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => ok(''); fr.readAsDataURL(blob); });
  } catch (_) { return ''; }
};

const formatoImagem = (dataUrl) => (/^data:image\/png/.test(dataUrl) ? 'PNG' : 'JPEG');

export async function gerarFichaEpi({ empresa, funcionario, entregas, devolucoes }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 12; const W = 186; const ALTO = 285;
  let y = 14;
  let token = '';
  try { token = await pb.files.getToken(); } catch (_) { /* sem foto */ }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text('FICHA DE CONTROLE DE EPI', 105, y, { align: 'center' }); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${empresa?.name || ''}${empresa?.cnpj ? ` · CNPJ ${empresa.cnpj}` : ''}`, 105, y, { align: 'center' }); y += 7;

  const f = funcionario || {};
  const linhas = [
    ['Funcionário', f.nome_completo || f.nome || ''],
    ['Matrícula', f.matricula || ''], ['CPF', f.cpf || ''],
    ['Função', f.funcao || f.expand?.cargoId?.nome || ''], ['Admissão', dataBR(f.dataAdmissao)],
  ];
  doc.setDrawColor(180); doc.rect(L, y - 4, W, 15);
  doc.text(`Funcionário: ${linhas[0][1]}`, L + 2, y);
  doc.text(`Matrícula: ${linhas[1][1]}`, L + 120, y); y += 5;
  doc.text(`CPF: ${linhas[2][1]}`, L + 2, y);
  doc.text(`Função: ${linhas[3][1]}`, L + 60, y);
  doc.text(`Admissão: ${linhas[4][1]}`, L + 120, y); y += 10;

  // Tabela: Data | EPI | CA | Qtd | Devolução | Assinatura | Foto
  const col = [L, L + 20, L + 76, L + 96, L + 106, L + 128, L + 166];
  const cab = ['Data', 'EPI', 'CA', 'Qtd', 'Devolução', 'Assinatura', 'Foto'];
  const cabecalho = () => {
    doc.setFillColor(235); doc.rect(L, y - 4, W, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    cab.forEach((c, i) => doc.text(c, col[i] + 1, y));
    doc.setFont('helvetica', 'normal'); y += 4;
  };
  cabecalho();
  const devDe = (id) => devolucoes.find((d) => d.entrega_id === id);
  const ordenadas = [...entregas].sort((a, b) => String(a.data_entrega).localeCompare(String(b.data_entrega)));
  if (!ordenadas.length) { doc.text('Nenhuma entrega registrada.', L + 2, y + 5); y += 10; }
  for (const e of ordenadas) {
    const h = 20;
    if (y + h > ALTO - 45) { doc.addPage(); y = 14; cabecalho(); }
    doc.setDrawColor(210); doc.rect(L, y, W, h);
    const dv = devDe(e.id);
    const nomeEpi = doc.splitTextToSize(e.expand?.epi_id?.nome || '', 54);
    doc.text(dataBR(e.data_entrega), col[0] + 1, y + 5);
    doc.text(nomeEpi.slice(0, 3), col[1] + 1, y + 5);
    doc.text(String(e.ca_utilizado || e.expand?.epi_id?.numero_ca || ''), col[2] + 1, y + 5);
    doc.text(String(e.quantidade || ''), col[3] + 1, y + 5);
    doc.text(dv ? dataBR(dv.data_devolucao) : (e.situacao === 'Devolvido' ? 'Devolvido' : '—'), col[4] + 1, y + 5);
    if (e.assinatura_digital && /^data:image/.test(e.assinatura_digital)) {
      try { doc.addImage(e.assinatura_digital, 'PNG', col[5] + 1, y + 1, 36, 18); } catch (_) { /* assinatura ilegível */ }
    }
    const foto = await fotoDataUrl(e, 'foto_retirada', token);
    if (foto) { try { doc.addImage(foto, formatoImagem(foto), col[6] + 1, y + 1, 18, 18); } catch (_) { /* foto ilegível */ } }
    y += h;
  }

  // Termo de responsabilidade (NR-6, 6.6.1)
  if (y > ALTO - 45) { doc.addPage(); y = 14; }
  y += 8;
  doc.setFontSize(8.5);
  const termo = 'Declaro que recebi gratuitamente os Equipamentos de Proteção Individual (EPI) relacionados acima, em perfeito ' +
    'estado, e que fui orientado sobre o uso correto, a guarda e a conservação. Comprometo-me a usá-los apenas para a ' +
    'finalidade a que se destinam, a comunicar qualquer alteração que os torne impróprios para uso e a devolvê-los quando ' +
    'solicitado, conforme a NR-6 (item 6.6.1). Estou ciente de que a recusa injustificada ao uso do EPI constitui ato faltoso.';
  doc.text(doc.splitTextToSize(termo, W), L, y); y += 22;
  doc.line(L + 4, y, L + 84, y); doc.line(L + 102, y, L + 182, y); y += 4;
  doc.text('Assinatura do funcionário', L + 26, y); doc.text('Responsável pela entrega', L + 125, y); y += 6;
  doc.setFontSize(7); doc.setTextColor(120);
  doc.text(`Gerado pelo APP OBRA em ${new Date().toLocaleString('pt-BR')}`, L, y);

  const nomeArq = (f.nome_completo || f.nome || 'funcionario').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '-').toLowerCase();
  doc.save(`ficha-epi-${nomeArq}.pdf`);
}
