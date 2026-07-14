import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_STATE, isUSState, type USState } from "@shared/states";

type StateContextValue = {
  state: USState;
  setState: (s: USState) => void;
};

const StateContext = createContext<StateContextValue>({
  state: DEFAULT_STATE,
  setState: () => {},
});

const STORAGE_KEY = "oal_selected_state";

export function StateProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateRaw] = useState<USState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isUSState(stored)) return stored;
    } catch {
      /* SSR / privacy mode */
    }
    return DEFAULT_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, state);
    } catch {
      /* ignore */
    }
  }, [state]);

  return (
    <StateContext.Provider value={{ state, setState: setStateRaw }}>
      {children}
    </StateContext.Provider>
  );
}

export function useSelectedState() {
  return useContext(StateContext);
}
