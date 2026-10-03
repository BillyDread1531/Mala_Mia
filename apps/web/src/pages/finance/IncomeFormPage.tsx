import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPaymentMethods } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { createManualIncome } from '../../api/finance';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import type { PaymentMethod } from '../../types/catalog';
import './ExpenseFormPage.css';

/** Ingreso manual: dinero que entra sin ser una venta (ej. inyección de
 * capital). Reutiliza el mismo layout que "Registrar gasto" — son el mismo
 * tipo de formulario simple, solo cambia la dirección del dinero. */
export function IncomeFormPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPaymentMethods('expenses')
      .then(setPaymentMethods)
      .catch(() => notify.error('No se pudieron cargar las formas de pago.'));
  }, [notify]);

  async function handleSubmit() {
    if (!description.trim()) {
      notify.error('Describe de dónde viene el dinero.');
      return;
    }
    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      notify.error('Ingresa un monto válido.');
      return;
    }
    if (!paymentMethodId) {
      notify.error('Selecciona una forma de pago.');
      return;
    }

    setSaving(true);
    try {
      await createManualIncome({
        description: description.trim(),
        amount: amountNumber,
        paymentMethodId: Number(paymentMethodId),
      });
      notify.success('Ingreso registrado.');
      navigate('/finanzas');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo registrar el ingreso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="expense-form">
      <header className="expense-form__header">
        <h1>Registrar ingreso</h1>
      </header>

      <Card className="expense-form__section">
        <div className="expense-form__row">
          <Input
            label="Monto (Q)"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <div className="field">
            <label className="field__label" htmlFor="income-payment-method">
              Forma de pago
            </label>
            <select
              id="income-payment-method"
              className="field__input"
              value={paymentMethodId}
              onChange={(event) =>
                setPaymentMethodId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Selecciona una forma de pago</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Input
          label="¿De dónde viene el dinero?"
          placeholder="Ej. Inyección de capital"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Card>

      <div className="expense-form__actions">
        <Button type="button" variant="ghost" onClick={() => navigate('/finanzas')}>
          Cancelar
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSubmit()}>
          Registrar ingreso
        </Button>
      </div>
    </div>
  );
}
