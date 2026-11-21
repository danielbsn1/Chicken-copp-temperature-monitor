import { useState, type FormEvent } from "react";
import { Button, Field } from "../../../shared/ui";
import { pairingErrorMessage, useAvailableDevices } from "../devices.hooks";
import type { ClaimInput, SignupInput } from "../devices.schemas";
import styles from "./PairForm.module.css";

interface PairFormProps {
  /** Com `signup`, pede também e-mail e senha para criar a conta. */
  signup?: boolean;
  pending: boolean;
  error: unknown;
  onSubmit: (input: SignupInput | ClaimInput) => void;
}

/**
 * Passo a passo do pareamento: o painel procura os equipamentos com o botão apertado na mesma
 * rede; se não achar, dá para digitar o serial da etiqueta.
 */
export function PairForm({ signup = false, pending, error, onSubmit }: PairFormProps) {
  const available = useAvailableDevices();
  const found = available.data?.devices ?? [];
  const [chosen, setChosen] = useState("");
  const [manual, setManual] = useState(false);
  const [typedSerial, setTypedSerial] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Com um só equipamento na rede, ele já vem escolhido.
  const serial = manual
    ? typedSerial.trim()
    : found.some((d) => d.serial === chosen)
      ? chosen
      : (found.length === 1 ? found[0]?.serial : "") || "";
  const ready = serial !== "" && name.trim() !== "" && (!signup || (email && password));

  function submit(event: FormEvent) {
    event.preventDefault();
    const base = { serial, name: name.trim(), manual };
    onSubmit(signup ? { ...base, email, password } : base);
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <ol className={styles.steps}>
        <li>Ligue o equipamento e conecte-o ao Wi-Fi.</li>
        <li>Aperte o botão de pareamento nele (a janela fica aberta por 5 minutos).</li>
        <li>Escolha-o abaixo e dê um nome.</li>
      </ol>

      {manual ? (
        <Field
          label="Serial da etiqueta"
          name="serial"
          autoComplete="off"
          value={typedSerial}
          onChange={(e) => setTypedSerial(e.target.value)}
        />
      ) : (
        <fieldset className={styles.found}>
          <legend>Equipamentos encontrados</legend>
          {found.length === 0 ? (
            <p role="status" className={styles.searching}>
              Procurando equipamentos na sua rede…
            </p>
          ) : (
            found.map((d) => (
              <label key={d.serial} className={styles.option}>
                <input
                  type="radio"
                  name="serial"
                  value={d.serial}
                  checked={serial === d.serial}
                  onChange={() => setChosen(d.serial)}
                />
                <span>
                  {d.serial} <small>firmware {d.fwVersion}</small>
                </span>
              </label>
            ))
          )}
        </fieldset>
      )}
      <button type="button" className={styles.link} onClick={() => setManual((m) => !m)}>
        {manual ? "Procurar na rede" : "Não aparece? Digite o serial da etiqueta"}
      </button>

      <Field
        label="Nome do galinheiro"
        name="name"
        autoComplete="off"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {signup ? (
        <>
          <Field
            label="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Senha (mínimo 12 caracteres)"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {pairingErrorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !ready}>
        {pending
          ? "Vinculando…"
          : signup
            ? "Criar conta e vincular"
            : "Vincular equipamento"}
      </Button>
    </form>
  );
}
