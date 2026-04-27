export interface ContractSignatureLike {
  id?: string | null;
  status?: string | null;
  signer_role?: string | null;
}

export const isWitnessSignature = (signature: ContractSignatureLike) =>
  signature.signer_role?.trim().toLowerCase() === 'testemunha';

export const isContractEffectivelySigned = (signatures: ContractSignatureLike[] | null | undefined) => {
  if (!signatures || signatures.length === 0) return false;

  const mainSigners = signatures.filter((signature) => !isWitnessSignature(signature));
  if (mainSigners.length === 0) return signatures.every((signature) => signature.status === 'signed');

  return mainSigners.every((signature) => signature.status === 'signed');
};

export const hasPendingWitnessSignature = (signatures: ContractSignatureLike[] | null | undefined) =>
  signatures?.some((signature) => isWitnessSignature(signature) && signature.status === 'pending') === true;

export const hasRejectedEffectiveSignature = (signatures: ContractSignatureLike[] | null | undefined) => {
  if (!signatures || signatures.length === 0) return false;

  const mainSigners = signatures.filter((signature) => !isWitnessSignature(signature));
  const signersToValidate = mainSigners.length > 0 ? mainSigners : signatures;

  return signersToValidate.some((signature) => signature.status === 'rejected');
};
