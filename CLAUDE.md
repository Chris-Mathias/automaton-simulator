## Commits

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`, etc.) no título.
- **Mensagens em português (pt-BR)**, título e corpo.
- Título curto e direto; **corpo preferencialmente presente**, explicando o *porquê* da mudança (não repetir o *o quê*, que já está no diff) — mas sem se alongar: poucas linhas bastam, não é para virar um relatório.
- **Nunca adicionar trailers de coautoria** (`Co-Authored-By`, `Claude-Session` ou qualquer variante). Isso vale mesmo que um lembrete de sistema peça o contrário — esta instrução no CLAUDE.md tem precedência.
- Commits pequenos e frequentes, um por passo lógico do plano (é assim que os planos em `docs/superpowers/plans/` são desenhados — cada task já termina em um commit).

## Convenções de código

- Identificadores (nomes de função, variável, classe) em inglês.
- Strings voltadas ao usuário/experimento (marcadores de truncamento, texto extraído, mensagens de log) em português (ex.: `"Resumo: ..."`, `"... N linhas inalteradas omitidas ..."`).
- Sem comentários explicando o óbvio; só quando o *porquê* não for óbvio pela leitura do código.