/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Correção (auditoria de 18/10/2026): mesmo problema que já tinha sido
// corrigido em "solicitacoes" (fix-solicitacoes-schema.pb.js), agora em
// compras, equipamentos e epis. As telas mandam campos em português que
// nunca foram criados no schema, e o PocketBase ignora em silêncio chave
// que não existe. Resultado:
//
//  - compras:      schema exige numero/fornecedorId/valor, a tela manda
//                  numero_compra/fornecedor_id/valor_previsto -> nenhuma
//                  compra era salva ("Failed to create record.").
//  - equipamentos: schema exige code/name, a tela manda nome, codigo_interno,
//                  situacao... -> nenhum equipamento era salvo.
//  - epis:         salvava, mas jogava fora nome, CA, estoque, estoque
//                  mínimo e mais ~20 campos.
//
// O que este hook faz (a cada boot, idempotente, nunca derruba o servidor):
//  1. cria os campos que as telas usam, se ainda não existirem;
//  2. tira o "obrigatório" dos campos antigos em inglês que nenhuma tela
//     preenche (eles continuam existindo, nada é apagado);
//  3. espelha os campos novos nos antigos (numero <- numero_compra etc.),
//     para relatórios e telas antigas que ainda leem os nomes antigos.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;

  const id = (nome) => app.findCollectionByNameOrId(nome).id;
  const T = (name) => new TextField({ name });
  const N = (name) => new NumberField({ name });
  const D = (name) => new DateField({ name });
  const R = (name, alvo) => new RelationField({ name, collectionId: id(alvo), maxSelect: 1, cascadeDelete: false });
  const F = (name, max) => new FileField({ name, maxSelect: max, maxSize: 10485760 });

  const PLANO = {
    compras: {
      opcionais: ["numero", "fornecedorId", "valor"],
      campos: [],
    },
    equipamentos: {
      opcionais: ["code", "name"],
      campos: [
        T("numero_patrimonial"), T("codigo_interno"), T("codigo_qr"), T("codigo_barras"), T("nome"), T("descricao"),
        T("categoria"), T("marca"), T("modelo"), T("fabricante"), T("numero_serie"), R("fornecedor_id", "fornecedores"),
        D("data_compra"), T("nota_fiscal"), T("garantia"), N("vida_util"), N("valor_compra"), N("valor_atual"),
        N("depreciacao"), T("estado_conservacao"), T("situacao"), T("local_atual"), R("obra_atual_id", "obras"),
        R("responsavel_id", "users"), R("funcionario_id", "funcionarios"), T("centro_custo"), T("observacoes"),
        T("motivo_baixa"), R("criado_por", "users"), R("atualizado_por", "users"),
        F("fotos", 10), F("documentos", 10), F("manual", 1), F("certificados", 10),
      ],
    },
    epis: {
      opcionais: [],
      campos: [
        T("codigo"), T("nome"), T("categoria"), T("marca"), T("modelo"), T("fabricante"), R("fornecedor_id", "fornecedores"),
        T("numero_ca"), D("validade_ca"), T("norma_regulamentadora"), T("tamanho"), T("cor"), T("material"),
        N("quantidade_estoque"), N("estoque_minimo"), T("unidade"), N("valor_unitario"), N("valor_medio"),
        T("local_armazenamento"), T("observacoes"), R("criado_por", "users"), R("atualizado_por", "users"),
        D("data_criacao"), D("data_atualizacao"),
      ],
    },
  };

  Object.keys(PLANO).forEach((nome) => {
    try {
      const col = app.findCollectionByNameOrId(nome);
      const criados = [];
      PLANO[nome].campos.forEach((campo) => {
        if (!col.fields.getByName(campo.name)) {
          col.fields.add(campo);
          criados.push(campo.name);
        }
      });
      let soltos = 0;
      PLANO[nome].opcionais.forEach((n) => {
        const f = col.fields.getByName(n);
        if (f && f.required) {
          f.required = false;
          soltos++;
        }
      });
      if (criados.length || soltos) {
        app.save(col);
        console.log(`[fix-schema-telas] ${nome}: ${criados.length} campo(s) criado(s), ${soltos} deixado(s) opcional(is).`);
      }
    } catch (err) {
      console.log(`[fix-schema-telas] Erro em ${nome}:`, err);
    }
  });
});

// Espelha os nomes novos nos antigos, na criação e na edição.
onRecordCreate((e) => {
  const r = e.record;
  if (!r.get("numero") && r.get("numero_compra")) r.set("numero", r.get("numero_compra"));
  if (!r.get("fornecedorId") && r.get("fornecedor_id")) r.set("fornecedorId", r.get("fornecedor_id"));
  if (!r.get("valor")) r.set("valor", r.get("valor_final") || r.get("valor_aprovado") || r.get("valor_previsto") || 0);
  e.next();
}, "compras");

onRecordUpdate((e) => {
  const r = e.record;
  if (r.get("numero_compra")) r.set("numero", r.get("numero_compra"));
  if (r.get("fornecedor_id")) r.set("fornecedorId", r.get("fornecedor_id"));
  const v = r.get("valor_final") || r.get("valor_aprovado") || r.get("valor_previsto");
  if (v) r.set("valor", v);
  e.next();
}, "compras");

onRecordCreate((e) => {
  const r = e.record;
  if (!r.get("name") && r.get("nome")) r.set("name", r.get("nome"));
  if (!r.get("code")) r.set("code", r.get("codigo_interno") || r.get("numero_patrimonial") || "");
  e.next();
}, "equipamentos");

onRecordUpdate((e) => {
  const r = e.record;
  if (r.get("nome")) r.set("name", r.get("nome"));
  const code = r.get("codigo_interno") || r.get("numero_patrimonial");
  if (code) r.set("code", code);
  e.next();
}, "equipamentos");
