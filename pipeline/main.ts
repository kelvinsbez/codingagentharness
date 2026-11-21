import { asyncScheduler, type SchedulerLike } from "rxjs";
import type { Pedido } from "./domain/pedido";
import type { Servicos } from "./domain/servicos";
import { conectarHandlers } from "./handlers/conectar";
import { Barramento } from "./infra/barramento";
import { GeradorPedidos, criarPedidosDeTeste } from "./infra/gerador";
import { criarServicosSimulados } from "./infra/servicos-simulados";

export function criarPipeline(servicos: Servicos, scheduler: SchedulerLike = asyncScheduler) {
  const barramento = new Barramento();
  const gerador = new GeradorPedidos(barramento, scheduler);
  const assinaturas = conectarHandlers(barramento, servicos, scheduler);
  let encerramento: Promise<void> | undefined;

  return {
    eventos$: barramento.eventos$,
    publicarPedido: (pedido: Pedido) => gerador.publicar(pedido),
    gerarPedidos: (pedidos: readonly Pedido[], intervaloMs = 25) =>
      gerador.gerar(pedidos, intervaloMs),
    encerrar(): Promise<void> {
      if (!encerramento) {
        gerador.parar();
        encerramento = barramento.aguardarOciosidade().then(() => {
          assinaturas.unsubscribe();
          barramento.encerrar();
        });
      }
      return encerramento;
    },
  };
}

async function executarDemo(): Promise<void> {
  const servicos = criarServicosSimulados({
    estoqueInicial: { livro: 1 },
    cobrar: (pedido) => ({ resultado: pedido.id === "pedido-2" ? "recusado" : "aprovado" }),
  });
  const pipeline = criarPipeline(servicos);
  pipeline.eventos$.subscribe(({ pedido, tipo }) => console.log(`${pedido.id} ${tipo}`));

  const desligar = () => { void pipeline.encerrar(); };
  process.on("SIGINT", desligar);
  process.on("SIGTERM", desligar);
  try {
    await pipeline.gerarPedidos(criarPedidosDeTeste(3));
  } finally {
    await pipeline.encerrar();
    process.off("SIGINT", desligar);
    process.off("SIGTERM", desligar);
  }
}

if (require.main === module) {
  executarDemo().catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  });
}
