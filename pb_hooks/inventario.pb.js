/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Levantamento do banco, SÓ LEITURA (pedido do Diego, 21/10/2026): antes de
// apagar os dados de teste, o servidor escreve no registro (log) o que existe
// — superusuários, empresas, logins e quantos registros cada empresa tem em
// cada tabela. Não altera nada. Sai depois da limpeza.
//
// Também cria o superusuário do titular (dnmltda@hotmail.com) se ele não
// existir, com uma senha aleatória que ninguém conhece. A senha dele vem do
// próprio Diego: "Forgot password" no painel /_/ ou o Secret do Fly
// SENHA_SUPERUSUARIO_TITULAR (ele coloca, entra e tira). Nenhuma senha fica no
// código. Os outros superusuários só saem depois que ele confirmar o acesso.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  const log = (m) => console.log(`[inventario] ${m}`);
  const linhas = (sql, modelo) => {
    const rows = arrayOf(new DynamicModel(modelo));
    app.db().newQuery(sql).all(rows);
    return rows;
  };
  try {
    require(`${__hooks}/dono-lib.js`).garantir(app); // a lista abaixo lê users.dono_sistema
    const TITULAR = "dnmltda@hotmail.com";
    let su = null;
    try { su = app.findAuthRecordByEmail("_superusers", TITULAR); } catch (_) {}
    if (!su) {
      su = new Record(app.findCollectionByNameOrId("_superusers"));
      su.set("email", TITULAR);
      su.setPassword($security.randomString(48));
      app.save(su);
      log(`superusuário ${TITULAR} criado (senha aleatória: defina a sua em /_/ → Forgot password).`);
    }

    // Senha do superusuário do titular definida pelo próprio Diego nos Secrets do Fly
    // (SENHA_SUPERUSUARIO_TITULAR); depois de entrar em /_/, ele tira a variável.
    const nova = String($os.getenv("SENHA_SUPERUSUARIO_TITULAR") || "");
    if (nova.length >= 10) {
      su.setPassword(nova);
      app.save(su);
      log("senha do superusuário do titular definida pelo Secret do Fly. Entre em /_/ e depois tire SENHA_SUPERUSUARIO_TITULAR dos Secrets.");
    } else if (nova) {
      log("SENHA_SUPERUSUARIO_TITULAR muito curta (mínimo 10 caracteres): nada foi mudado.");
    }

    linhas("SELECT email, created FROM _superusers ORDER BY created", { email: "", created: "" })
      .forEach((r) => log(`superusuário: ${r.email} (desde ${String(r.created).slice(0, 10)})`));

    const empresas = linhas("SELECT id, name, created FROM companies ORDER BY created", { id: "", name: "", created: "" });
    const nomes = {};
    empresas.forEach((c) => { nomes[c.id] = c.name; });
    log(`${empresas.length} empresa(s) em companies.`);

    // Registros por empresa em cada tabela que tem company_id.
    const porEmpresa = {}; // company_id -> ["tabela: n", ...]
    app.findAllCollections().forEach((col) => {
      if (col.type === "view" || col.system || !col.fields.getByName("company_id")) return;
      try {
        linhas(`SELECT COALESCE(company_id, '') AS cid, COUNT(*) AS n FROM ${col.name} GROUP BY cid`, { cid: "", n: 0 })
          .forEach((r) => { (porEmpresa[r.cid] = porEmpresa[r.cid] || []).push(`${col.name}: ${r.n}`); });
      } catch (_) { /* tabela sem dados legíveis */ }
    });
    empresas.forEach((c) => log(`empresa ${c.id} "${c.name}" (criada ${String(c.created).slice(0, 10)}) → ${(porEmpresa[c.id] || ["vazia"]).join(", ")}`));
    Object.keys(porEmpresa).filter((k) => !nomes[k]).forEach((k) =>
      log(`registros sem empresa válida (${k || "vazio"}) → ${porEmpresa[k].join(", ")}`));

    linhas("SELECT email, name, cargo, id_unico, status, company_id, dono_sistema FROM users ORDER BY company_id, id_unico",
      { email: "", name: "", cargo: "", id_unico: "", status: "", company_id: "", dono_sistema: false })
      .forEach((u) => log(`login: ${u.email} | ${u.name} | ${u.cargo} | ID ${u.id_unico} | ${u.status}${u.dono_sistema ? " | DONO" : ""} | empresa "${nomes[u.company_id] || u.company_id}"`));
    log("fim do levantamento (nada foi alterado).");
  } catch (err) {
    console.log("[inventario] Erro:", err);
  }
});
