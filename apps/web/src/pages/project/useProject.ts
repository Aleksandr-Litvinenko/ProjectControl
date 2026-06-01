import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ProjectDetail } from '../../lib/types';

export function useProject(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
  });
}

export function useProjectMutation(id: string) {
  const qc = useQueryClient();
  return (fn: () => Promise<unknown>) =>
    fn().then(() => qc.invalidateQueries({ queryKey: ['project', id] }));
}

export function useInvalidateProject(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export { useMutation };
