import { Subscription } from "rxjs";
import { Pedido } from "./domain/eventos";
import { iniciarEnvio } from "./handlers/envio";
import { iniciarEstoque } from "./handlers/estoque";
import { iniciarNotificacao } from "./handlers/notificacao";
import { iniciarPagamento } from "./handlers/pagamento";
import { Atividades } from "./infra/atividades";
import { Barramento } from "./infra/barramento";
import { GeradorPedidos } from "./infra/gerador";
import { Processamento } from "./infra/processamento";
import { criarServicosSimulados, Servicos } from "./infra/servicos";

export function criarSistema(servicos: Servicos) {
    const atividades = new Atividades();
    const barramento = new Barramento(atividades);
    const processamento = new Processamento(barramento, atividades);
    const gerador = new GeradorPedidos(barramento);
    const assinaturas = new Subscription();

    assinaturas.add(iniciarPagamento(barramento, processamento, servicos.pagamento));
    assinaturas.add(iniciarEstoque(barramento, processamento, servicos.estoque));
    assinaturas.add(iniciarEnvio(barramento, processamento, servicos.transporte));
    assinaturas.add(iniciarNotificacao(barramento, processamento, servicos.mensagens));

    let encerramento: Promise<void> | undefined;
    return {
        eventos$: barramento.eventos$,
        publicarPedido: (pedido: Pedido) => gerador.publicar(pedido),
        gerarPedidos: (pedidos: readonly Pedido[], intervaloMs: number) => gerador.gerar(pedidos, intervaloMs),
        encerrar(): Promise<void> {
            if (!encerramento) {
                gerador.encerrar();
                encerramento = atividades.aguardar().then(() => {
                    assinaturas.unsubscribe();
                    barramento.encerrar();
                });
            }
            return encerramento;
        },
    };
}

async function executarDemonstracao(): Promise<void> {
    const pedidos: Pedido[] = ["1", "2", "3"].map(id => ({
        id, cliente: "cliente-" + id, itens: [{ produtoId: "produto", quantidade: 1 }],
    }));
    const sistema = criarSistema(criarServicosSimulados({
        estoqueInicial: { produto: 1 },
        cobrar: pedido => ({
            atrasoMs: 50,
            valor: pedido.id === "2" ? { aprovado: false } : { aprovado: true, cobrancaId: pedido.id },
        }),
    }));

    sistema.eventos$.subscribe(evento => console.log(evento.pedido.id, evento.tipo));
    const parar = () => { void sistema.encerrar(); };
    process.on("SIGINT", parar);
    process.on("SIGTERM", parar);

    try {
        await sistema.gerarPedidos(pedidos, 100);
    } finally {
        await sistema.encerrar();
        process.off("SIGINT", parar);
        process.off("SIGTERM", parar);
    }
}

if (require.main === module) {
    executarDemonstracao().catch(erro => {
        console.error(erro);
        process.exitCode = 1;
    });
}
