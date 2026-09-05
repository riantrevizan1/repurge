# Repurge — Guia de Início Rápido

Este guia cobre a configuração inicial do ambiente e o primeiro commit do projeto.

## 1. Abra o terminal

No macOS, pressione `Cmd + Space`, digite `Terminal` e pressione Enter.

## 2. Execute o script de setup

No terminal, execute:

```bash
cd ~/repurge && bash SETUP.sh
```

O script realiza as seguintes etapas:
- Instala as dependências do projeto
- Compila o TypeScript
- Executa a suíte de testes (10/10 devem passar)
- Exibe os próximos passos ao final

## 3. Crie o primeiro commit

Após a conclusão do script, execute:

```bash
git add .
git commit -m "Initial commit: Foundation + NodeModulesDetector (TDD)"
git push -u origin main
```

## Resultado esperado

Ao final desse processo, o repositório estará disponível no GitHub com:
- Todo o código TypeScript versionado
- A suíte de testes passando
- Base pronta para o desenvolvimento dos próximos detectores

## Próximos passos

Os próximos itens planejados para o desenvolvimento são:
- `GitWorktreesDetector`
- `PackageCachesDetector`
- Implementação dos Cleaners

## Solução de problemas

Caso o script `SETUP.sh` ou algum comando falhe, registre a mensagem de erro completa exibida no terminal antes de prosseguir com a investigação.
