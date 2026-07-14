import { trpc } from "@/lib/trpc";

/**
 * Single-user app session (mike.ford). Independent of Manus OAuth.
 */
export function useAppSession() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.appAuth.session.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.appAuth.login.useMutation({
    onSuccess: () => utils.appAuth.session.invalidate(),
  });

  const logoutMutation = trpc.appAuth.logout.useMutation({
    onSuccess: () => {
      utils.appAuth.session.invalidate();
      utils.agents.invalidate();
    },
  });

  return {
    loading: isLoading,
    authenticated: data?.authenticated ?? false,
    username: data?.username ?? null,
    login: loginMutation,
    logout: logoutMutation,
  };
}
