/**
 * AuthContext - global user state, login/logout helpers.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { getToken, getUser, setToken, setUser, removeToken, removeUser } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(getUser());
  const [token, setTokenState] = useState(getToken());

  const saveSession = (data) => {
    setToken(data.access_token);
    const u = { name: data.user_name, email: data.user_email };
    setUser(u);
    setTokenState(data.access_token);
    setUserState(u);
  };

  const logout = () => {
    removeToken();
    removeUser();
    setTokenState(null);
    setUserState(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, saveSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
