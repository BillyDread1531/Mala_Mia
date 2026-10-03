import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listExpenseCategories, listPaymentMethods } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { createExpense } from '../../api/expenses';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import type { ExpenseCategory, PaymentMethod } from '../../types/catalog';
import './ExpenseFormPage.css';

export function ExpenseFormPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listExpenseCategories(), listPaymentMethods('expenses')])
      .then(([cats, methods]) => {
        setCategories(cats);
        setPaymentMethods(methods);
      })
      .catch(() => notify.error('No se pudieron cargar las categorías o formas de pago.'));
  }, [notify]);

  async function handleSubmit() {
    if (!categoryId) {
      notify.error('Selecciona una categoría.');
      return;
    }
    if (!description.trim()) {
      notify.error('Describe en qué se usó el dinero.');
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
      await createExpense({
        categoryId: Number(categoryId),
        description: description.trim(),
        amount: amountNumber,
        paymentMethodId: Number(paymentMethodId),
        notes: notes.trim() || undefined,
      });
      notify.success('Gasto registrado.');
      navigate('/finanzas');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo registrar el gasto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="expense-form">
      <header className="expense-form__header">
        <h1>Registrar gasto</h1>
      </header>

      <Card className="expense-form__section">
        <div className="expense-form__row">
          <div className="field">
            <label className="field__label" htmlFor="expense-category">
              Categoría
            </label>
            <select
              id="expense-category"
              className="field__input"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Monto (Q)"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>

        <Input
          label="¿En qué se usó el dinero?"
          placeholder="Ej. Bolsas de papel para empaque"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="field">
          <label className="field__label" htmlFor="expense-payment-method">
            Forma de pago
          </label>
          <select
            id="expense-payment-method"
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

        <div className="field">
          <label className="field__label" htmlFor="expense-notes">
            Notas (opcional)
          </label>
          <textarea
            id="expense-notes"
            className="field__input"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </Card>

      <div className="expense-form__actions">
        <Button type="button" variant="ghost" onClick={() => navigate('/finanzas')}>
          Cancelar
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSubmit()}>
          Registrar gasto
        </Button>
      </div>
    </div>
  );
}
