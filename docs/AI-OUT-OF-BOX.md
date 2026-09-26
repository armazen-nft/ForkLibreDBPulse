# AI OUT OF BOX — base LibreDB

## Entrega e estado

Clone integral em `ai-out-of-box/`, com histórico Git e licença MIT original preservados. Origem: https://github.com/libredb/libredb-studio. Commit verificado: `1039c1d45032e024e698136cd8ca7c1ad981dc62`, versão 0.16.0. Branch local: `codex/ai-out-of-box`; remoto de origem: `upstream`.

Destino da importação: https://github.com/armazen-nft/ForkLibreDBPulse. Este diagnóstico foi preparado antes da publicação; consulte o README raiz para o estado da entrega. O código da aplicação não foi modificado. Não foram instaladas dependências nem executados build, testes ou servidor. Node disponível: 24.17.0; Bun e Docker não foram encontrados no PATH. O projeto exige Node >=24 e declara Bun 1.4.2. Para instalação, seguir o README original e `.env.example`, preservando package.json, tsconfig.json e bun.lock.

## Mapa de utilidades preservadas

| Área | Utilidades |
|---|---|
| Editor | Monaco, autocompletar com schema, abas, paleta de comandos, consultas salvas e backup/importação da biblioteca |
| Estrutura | Explorer de schemas, diagramas ER, exportação PNG/SVG, snapshots, comparação e geração de migrações conforme o banco |
| Consultas | Execução SQL, planos EXPLAIN, transações e cancelamento conforme o driver |
| Dados | Grade virtualizada, edição de células quando suportada, filtros, importação CSV, exportação CSV/JSON, pivôs |
| Visualização | Oito tipos de gráfico, agregações, agrupamento temporal e persistência de gráficos |
| Análise | Perfil de colunas, estatísticas, documentação do banco e dicionário de dados |
| Desenvolvimento | Geração de interfaces TypeScript, schemas Zod, Prisma, Go, Python e Java; geração de dados de teste |
| Agente | Investigação, otimização, avaliação, relatórios com evidências, limites por execução e pipeline auditado |
| Modelos | Ollama, Gemini, OpenAI e endpoints compatíveis; capacidade de ferramentas necessária conforme o modo |
| Administração | Monitoramento, sessões, armazenamento, pools, tendências, indicadores de saúde e manutenção conforme o banco |
| Acesso | Login local, OIDC/SSO, mapeamento de papéis, SSH e TLS conforme o tipo de conexão |
| Distribuição | Aplicação standalone, pacote incorporável e configurações de implantação presentes no repositório; o pacote incorporável não inclui a interface do agente |

Bancos listados no README: PostgreSQL, MySQL, Oracle, SQL Server, SQLite, libSQL/Turso, DuckDB, MongoDB, Couchbase, ClickHouse, Druid, Elasticsearch, OpenSearch, Trino, Cassandra e Redis. Compatíveis por protocolo e diferenças por engine estão em `docs/providers/README.md`. Preservar todo o código não significa que todos os bancos ofereçam as mesmas funcionalidades.

## Correções ao texto da conversa

- O agente que executa SQL já contempla PostgreSQL, SQLite, DuckDB e SQL Server. Outros fluxos têm capacidades próprias; consultar `docs/AGENT.md`.
- O README atual documenta 18–45 statements, 360–900 segundos por execução e 200 linhas por leitura, conforme o fluxo. Não usar 20 consultas/60 segundos como contrato atual.
- Iniciar uma execução autoriza o agente a conduzir leituras dentro da política: não há exigência universal de aprovar cada consulta individual.
- A restrição read-only do agente não proíbe a escrita pelo editor ou pela grade quando suportada e autorizada pelo banco.
- Rodar a interface localmente não garante privacidade local: endpoints remotos recebem contexto. Ver `docs/AGENT_DATA_FLOW.md` antes de configurar um provedor externo.
- Schema real e evidências reduzem erros; não garantem ausência de alucinações.
- Auditoria do pipeline do agente e histórico de consultas do editor são mecanismos distintos; não presumir cobertura idêntica.

## Diagnóstico do guia PoE/SBL anexado

O anexo termina no meio de `streamChat`, portanto é incompleto. Ele ainda não entrega quatro modelos, integração funcional com LibreDB, medição elétrica ou ancoragem blockchain.

1. Substituir package.json e tsconfig.json pelos exemplos desmontaria a configuração original. A extensão deve ser aditiva.
2. SBL_SCHEMA usa `additionalProperties: false`, mas omite diversas propriedades que o logger sempre gera. Isso rejeita os próprios objetos do exemplo.
3. `confidence || 0.5` perde o valor legítimo zero. Defaults numéricos precisam preservar zero e validar limites.
4. A criação assíncrona das pastas não é aguardada antes da escrita. Erros de leitura são convertidos em lista vazia, ocultando corrupção e falhas de acesso.
5. O uso de `require` conflita com a configuração ESM apresentada.
6. O hash PoE cobre somente quatro campos; mudanças em duração, tokens, auditores ou outros metadados ficam fora da verificação.
7. A energia é recebida como argumento, não medida. Duração e tokens não comprovam kWh. Registrar explicitamente se a origem é sensor, estimativa ou valor informado, com unidade e método.
8. O armazenamento retorna `energy_kwh` enquanto a interface espera `energy_kWh`; também não converte explicitamente o booleano SQLite. A gravação omite os campos blockchain.
9. O mapa em memória não oferece persistência por si; `exportToDB` está vazio. Inicialização e erros SQLite precisam ser tratados.
10. Nomes de modelos, dependências e endpoints do anexo precisam ser verificados antes da instalação. O schema fixa modelos diferentes do modelo Qwen usado pelo exemplo.

## Integração proposta, ainda não implementada

Acoplar PoE ao pipeline de operações auditadas existente, com registro de objetivo, operação, resultado, duração, modelo, uso reportado de tokens e procedência da energia. Usar resumo de decisão observável, sem alegar consciência ou acesso ao raciocínio interno do modelo. Persistir registros completos com serialização determinística e testes de adulteração/round-trip. Hashes locais verificam consistência; não são prova independente do consumo físico nem impedem reescrita de todo o histórico por quem controla o armazenamento.

Para experimentos de escrita, criar uma conexão separada com cópia descartável dos dados e política explícita de operações. Isso exige implementação e testes próprios; remover um flag read-only não constitui um sandbox.

O destino definido pelo usuário é armazen-nft/ForkLibreDBPulse. Implementação PoE/SBL depende de confirmar que essa extensão faz parte desta etapa.
