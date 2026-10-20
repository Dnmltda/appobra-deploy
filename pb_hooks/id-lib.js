// Funções do ID por tempo de casa (usadas por id-tempo-de-casa.pb.js).
// Módulo à parte porque cada handler do JSVM roda isolado.

// Números já usados na empresa, em acessos e funcionários, inclusive
// arquivados/inativos: quem já foi da empresa continua dono do seu número.
function numerosUsados(app, companyId) {
  const usados = {};
  ["users", "funcionarios"].forEach((col) => {
    let recs = [];
    try {
      recs = app.findRecordsByFilter(col, "company_id = {:c}", "", 0, 0, { c: companyId });
    } catch (_) {}
    for (let i = 0; i < recs.length; i++) {
      const v = String(recs[i].get("id_unico") || "");
      if (/^\d+$/.test(v)) usados[parseInt(v, 10)] = true;
    }
  });
  return usados;
}

// Próximo número da empresa: o primeiro que ninguém usa nem usou. Só volta
// a ficar livre o número de quem foi apagado de vez (pedido do Diego,
// 19/10/2026: "esse nunca mais volta, apaga o ID dele").
function proximoIdDaEmpresa(app, companyId) {
  const usados = numerosUsados(app, companyId);
  let n = 1;
  while (usados[n]) n++;
  return String(n).padStart(2, "0");
}

// Mesma pessoa na outra coleção (para dar o MESMO id_unico): por id direto
// (funcionario_id, sempre confiável) ou, na falta dele, pelo e-mail — mas SÓ
// entre candidatos que ainda estão ativos. Sem isso, um cadastro antigo já
// excluído "trava" o número pra sempre: o e-mail bate, devolve o id_unico
// dele, e esse número nunca mais pode ser salvo por ninguém, porque o
// registro excluído continua ocupando o lugar no índice único mesmo
// escondido da tela. Corrigido em 19/10/2026.
function idDaMesmaPessoa(app, outraColecao, companyId, email, idDireto) {
  try {
    if (idDireto) {
      const v = String(app.findRecordById(outraColecao, idDireto).get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  } catch (_) {}
  if (!email) return "";
  try {
    const candidatos = app.findRecordsByFilter(outraColecao, "company_id = {:c} && email = {:e}", "", 10, 0,
      { c: companyId, e: String(email).toLowerCase() });
    for (let i = 0; i < candidatos.length; i++) {
      const rec = candidatos[i];
      const arquivado = !!rec.getString("deleted_at") || rec.get("is_active") === false;
      if (arquivado) continue;
      const v = String(rec.get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  } catch (_) {}
  return "";
}

// Quem já foi da empresa e voltou (convite ou cadastro novo): devolve o
// número antigo. Procura funcionários arquivados e acessos inativos da
// mesma empresa com o mesmo e-mail ou CPF.
function idDeQuemJaFoiDaEmpresa(app, companyId, email, cpf) {
  const filtros = [];
  const params = { c: companyId };
  if (email) { filtros.push("email = {:e}"); params.e = String(email).trim().toLowerCase(); }
  const soNumeros = String(cpf || "").replace(/\D/g, "");
  if (soNumeros.length === 11) {
    filtros.push("cpf = {:p1} || cpf = {:p2}");
    params.p1 = soNumeros;
    params.p2 = soNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (!filtros.length) return "";
  const cols = [["funcionarios", "deleted_at != ''"], ["users", "status != 'Ativo'"]];
  for (let c = 0; c < cols.length; c++) {
    let recs = [];
    try {
      recs = app.findRecordsByFilter(cols[c][0], `company_id = {:c} && ${cols[c][1]} && (${filtros.join(" || ")})`,
        "created", 20, 0, params);
    } catch (_) {}
    for (let i = 0; i < recs.length; i++) {
      const v = String(recs[i].get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  }
  return "";
}

// O índice de users (company_id, id_unico) conta também os acessos inativos.
// Quando o número volta para a mesma pessoa, o acesso antigo dela solta o
// número (fica "ARQ-<id>", como em acesso-email-reuso.pb.js).
function liberarNumeroDeAcessoAntigo(app, companyId, numero, novoId) {
  let antigos = [];
  try {
    antigos = app.findRecordsByFilter("users", "company_id = {:c} && id_unico = {:n} && status != 'Ativo' && id != {:id}",
      "", 10, 0, { c: companyId, n: numero, id: novoId || "" });
  } catch (_) {}
  antigos.forEach((u) => {
    app.db().newQuery("UPDATE users SET id_unico = {:v} WHERE id = {:id}").bind({ v: "ARQ-" + u.id, id: u.id }).execute();
    console.log(`[id-tempo-de-casa] acesso antigo ${u.id} soltou o número ${numero} para a mesma pessoa.`);
  });
}

module.exports = { proximoIdDaEmpresa, idDaMesmaPessoa, idDeQuemJaFoiDaEmpresa, liberarNumeroDeAcessoAntigo };
