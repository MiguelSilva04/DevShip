export interface FieldCollision {
  field: 'namespace' | 'argocd_application_name' | 'git_ops_base_path';
  value: string;
  detail: string;
}

/** Interpreta o texto de um 409 de _check_environment_collisions (backend) e devolve
 * qual campo e qual valor colidiu, extraindo o trecho entre aspas simples da mensagem
 * (ex.: "O namespace 'staging' já está..." -> {field: 'namespace', value: 'staging'}).
 * Devolve null se a mensagem não corresponder a nenhum padrão conhecido — nesse caso
 * quem chamar deve continuar a mostrar o erro genérico, não descartá-lo. */
export function parseCollisionDetail(detail: string): FieldCollision | null {
  const match = detail.match(/'([^']+)'/);
  if (!match) return null;
  const value = match[1];
  if (detail.includes('namespace')) return { field: 'namespace', value, detail };
  if (detail.includes('ArgoCD Application')) return { field: 'argocd_application_name', value, detail };
  if (detail.includes('path GitOps')) return { field: 'git_ops_base_path', value, detail };
  return null;
}
