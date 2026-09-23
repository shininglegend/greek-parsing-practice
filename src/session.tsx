import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { uploadLocalAttempts } from "./attempts";
import { getMe, type SessionUser } from "./studyApi";

type SessionValue = {
  user: SessionUser | null;
  turnstileSiteKey: string;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue>({
  user: null,
  turnstileSiteKey: "",
  loading: true,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getMe();
    setUser(data.user);
    setTurnstileSiteKey(data.turnstileSiteKey);
    // A guest's history lives in this browser until there is an account to hold it.
    uploadLocalAttempts(data.user).catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ user, turnstileSiteKey, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
