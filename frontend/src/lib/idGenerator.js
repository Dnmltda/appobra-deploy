import pb from '@/lib/pocketbaseClient';

const ID_PREFIXES = {
  users: 'USR',
  funcionarios: 'FUN',
  materiais: 'MAT',
  equipamentos: 'EQP',
  epis: 'EPI',
  obras: 'OBR',
  solicitacoes_compra: 'SOL',
  fornecedores: 'FOR',
  compras: 'COM',
  veiculos: 'VEI',
  treinamentos: 'TRE',
  escalas: 'ESC',
  equipes: 'EQU',
  documentos: 'DOC',
  abastecimentos: 'ABA',
  manutencoes: 'MAN',
  licenciamentos: 'LIC',
  quilometragem: 'KM'
};

export const generateNextId = async (collectionName, companyId) => {
  try {
    const prefix = ID_PREFIXES[collectionName];
    if (!prefix) {
      throw new Error(`No prefix defined for collection: ${collectionName}`);
    }

    // Cada empresa tem sua própria sequência de IDs, isolada das demais.
    // Corrigido: antes buscava TODOS os registros da collection sem
    // filtrar por empresa, fazendo empresas diferentes competirem pela
    // mesma numeração (e colidirem com o índice único do banco).
    const filter = companyId ? `company_id = "${companyId}"` : '';
    const records = await pb.collection(collectionName).getFullList({
      filter,
      sort: '-created',
      fields: 'id_unico',
      $autoCancel: false
    });

    let nextNumber = 1;

    if (records.length > 0) {
      // Find the highest number from existing IDs
      const numbers = records
        .map(r => r.id_unico)
        .filter(id => id && id.startsWith(prefix))
        .map(id => {
          const match = id.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        });

      if (numbers.length > 0) {
        nextNumber = Math.max(...numbers) + 1;
      }
    }

    // Format with leading zeros (6 digits)
    const formattedNumber = String(nextNumber).padStart(6, '0');
    return `${prefix}-${formattedNumber}`;
  } catch (error) {
    console.error('Error generating ID:', error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString().slice(-6);
    return `${ID_PREFIXES[collectionName] || 'GEN'}-${timestamp}`;
  }
};

export const validateIdUniqueness = async (collectionName, idValue) => {
  try {
    const records = await pb.collection(collectionName).getFullList({
      filter: `id_unico = "${idValue}"`,
      $autoCancel: false
    });
    return records.length === 0;
  } catch (error) {
    console.error('Error validating ID uniqueness:', error);
    return false;
  }
};