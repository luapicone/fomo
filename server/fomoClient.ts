const FOMO_API = 'https://prod-api.fomo.family';

export async function getFomoAuthStatus(token?: string): Promise<{ enabled: boolean; ok: boolean; message: string }> {
  if (!token) {
    return {
      enabled: false,
      ok: false,
      message: 'Modo publico: FOMO_AUTH_TOKEN no configurado.'
    };
  }

  const response = await fetch(`${FOMO_API}/v2/leaderboard/following`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Supported-Chains': 'solana,base,ethereum'
    }
  });

  return {
    enabled: true,
    ok: response.ok,
    message: response.ok ? 'Fomo API autenticada disponible.' : `Fomo API respondio ${response.status}. Revisar token.`
  };
}
