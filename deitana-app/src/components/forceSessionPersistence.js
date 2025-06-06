// Este archivo fuerza a Firebase a no recordar la sesión entre recargas (solo sesión actual)
import { setPersistence, browserSessionPersistence } from "firebase/auth";
import { auth } from "./Authenticator/firebase";

setPersistence(auth, browserSessionPersistence);
