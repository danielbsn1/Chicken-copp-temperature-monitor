import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
} from "./index";

describe("shared/ui", () => {
  it("Spinner tem role status e texto", () => {
    render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
  });

  it("ErrorState anuncia o erro e oferece 'Tentar de novo'", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Falhou" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("ErrorState sem onRetry não mostra o botão", () => {
    render(<ErrorState message="Falhou" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("EmptyState mostra a mensagem", () => {
    render(<EmptyState message="Nada por aqui" />);
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
  });

  it("Field associa o rótulo ao campo e liga o erro com aria-describedby", () => {
    render(<Field label="E-mail" error="Obrigatório" />);
    const input = screen.getByLabelText("E-mail");
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Obrigatório");
  });

  it("Field sem erro não marca o campo como inválido", () => {
    render(<Field label="Senha" type="password" />);
    expect(screen.getByLabelText("Senha")).toBeValid();
  });

  it("StatusBadge sempre mostra o texto, não só a cor", () => {
    render(<StatusBadge tone="critical" label="Crítico" />);
    expect(screen.getByText("Crítico")).toBeInTheDocument();
  });

  it("Card nomeia a seção pelo título", () => {
    render(
      <Card title="Resumo">
        <p>conteúdo</p>
      </Card>,
    );
    expect(screen.getByRole("region", { name: "Resumo" })).toBeInTheDocument();
  });

  it("Button usa type=button por padrão", () => {
    render(<Button variant="secondary">Ok</Button>);
    expect(screen.getByRole("button", { name: "Ok" })).toHaveAttribute("type", "button");
  });

  it("PageHeader mostra o título como h1 e as ações", () => {
    render(<PageHeader title="Painel" actions={<button type="button">Sair</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Painel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });
});
