-- Permite al paciente portal cancelar sus propias citas dentro del plazo
-- La validación de negocio (plazo) la hace el API; la RLS solo garantiza ownership
CREATE POLICY "portal_appointments_update_own"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND patient_id IN (
      SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
  );
