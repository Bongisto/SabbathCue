export type PaddleInitializePwCustomer = {
  id: string
}

export function buildPwCustomerOption(
  paddleCustomerId?: string | null
): { pwCustomer: PaddleInitializePwCustomer } | Record<string, never> {
  const id = paddleCustomerId?.trim()
  if (!id || !id.startsWith("ctm_")) return {}
  return { pwCustomer: { id } }
}
