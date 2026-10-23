# Logo do APP OBRA (by DNM&LTDA)

Aprovado pelo Diego em 23/10/2026. Segue o padrão dos apps da DNM&LTDA: símbolo próprio do app com a
**coroa dourada** no topo (ligação com a DNM&LTDA), nome em Playfair Display Black e "BY DNM&LTDA" com filetes.

**Símbolo:** capacete de obra em azul com volume (brilho, reflexo e sombra), contorno e aba dourados, crista
central e, na frente, um escudo creme com um prédio dourado (as obras que o app controla), mais brilhos dourados.

O logo oficial da DNM&LTDA (coroa + "DNM&LTDA" + "Tecnologia & Soluções Digitais") **não foi alterado**: está em
`docs/marca/logo-dnm-original.png` e serviu só de referência de estilo.

## Arquivos

| Arquivo | O que é | Onde usar |
|---|---|---|
| `app-obra-horizontal-claro.svg` / `.png` | Símbolo à esquerda, nome à direita; fundo transparente | Cabeçalhos, documentos, PDFs, site, assinatura de e-mail em fundo claro |
| `app-obra-horizontal-escuro.svg` / `.png` | Igual, sobre fundo azul-marinho | Faixas, banners e capas em fundo escuro |
| `app-obra-vertical-claro.svg` / `.png` | Símbolo em cima, nome embaixo; fundo transparente | Tela de abertura e login do app, cartazes, apresentações |
| `app-obra-vertical-escuro.svg` / `.png` | Igual, sobre fundo azul-marinho | Redes sociais, telas escuras, materiais impressos escuros |
| `app-obra-icone.svg` / `.png` | Quadrado com cantos arredondados, fundo azul-marinho, borda dourada, só o símbolo | Ícone do app (computador e celular), foto de perfil, favicon |
| `app-obra-simbolo.svg` / `.png` | Só o símbolo, fundo transparente | Menu do app e lugares pequenos |
| `gera-logo.py` | Gerador dos SVG (as letras viram desenho) | Refazer as versões se precisar |

- **SVG**: vetor, abre igual em qualquer computador (as letras já estão convertidas em desenho, não precisa da fonte).
- **PNG**: alta resolução (3x). As versões claras e o símbolo têm fundo transparente.
- Dentro do app: ícone de instalação e favicon (`frontend/public/icone-*.png`, `favicon-app.png`,
  `apple-touch-icon.png`), abertura e login (vertical claro) e menu (símbolo + nome).

## Cores (só estas)

| Cor | Código | Uso |
|---|---|---|
| Azul-marinho | `#0A1F4D` | Nome no fundo claro, fundo das versões escuras, base do degradê |
| Azul royal | `#1E40AF` | Topo do degradê do capacete |
| Dourado | `#E5B339` | Coroa, contornos, brilhos, "BY DNM&LTDA" no fundo escuro |
| Dourado escuro | `#B8862B` | Sombras do dourado, "BY DNM&LTDA" no fundo claro |
| Creme | `#F7EFDC` | Escudo e reflexos; nome no fundo escuro |

## Fontes (Google Fonts)

- **Playfair Display Black (900)**: "APP OBRA".
- **Montserrat Bold (700)**, letras espaçadas: "BY DNM&LTDA".

## Cuidados

- Não distorcer (sempre aumentar/diminuir proporcionalmente), não trocar as cores e não separar a coroa do capacete.
- Deixar um respiro em volta do logo de pelo menos a altura da coroa.
- Tamanho mínimo: símbolo com 24 px de largura na tela; versão horizontal com 160 px.
