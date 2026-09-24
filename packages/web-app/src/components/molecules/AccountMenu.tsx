import { Link } from "react-router-dom";
import { History, LogIn, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountMenuProps {
  status: "loading" | "signedIn" | "signedOut";
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** Header account control: "Sign in" when signed out, else an account dropdown. */
export function AccountMenu({ status, displayName, email, photoUrl, onSignIn, onSignOut }: AccountMenuProps) {
  if (status === "loading") return <div className="size-9" aria-hidden />;

  if (status === "signedOut") {
    return (
      <Button variant="ghost" size="sm" onClick={onSignIn}>
        <LogIn />
        <span className="hidden sm:inline">Sign in</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-7 rounded-full object-cover"
            />
          ) : (
            <UserRound />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <div className="flex flex-col gap-0.5 px-2 py-1.5 text-sm">
          <span className="truncate font-medium">{displayName || "Signed in"}</span>
          {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings?section=account">
            <History /> Ticket history
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
