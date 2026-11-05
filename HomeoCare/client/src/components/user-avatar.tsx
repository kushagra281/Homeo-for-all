import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { fetchAvatar } from "@/lib/avatar"
import { avatarInitial } from "@shared/avatar"

/** A round photo, or the person's initial on green when there is no photo. */
export function UserAvatar({ src, label, size = 32 }: { src?: string | null; label?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  return src ? (
    <img src={src} alt="" style={style} className="rounded-full object-cover border border-gray-200 bg-gray-100 shrink-0" />
  ) : (
    <span style={style} aria-hidden="true"
      className="rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center border border-green-200 shrink-0 select-none">
      {avatarInitial(label)}
    </span>
  )
}

/** The signed-in user's photo for the header, placed beside Translate. Opens the profile page. */
export default function HeaderAvatar({ user }: { user: any }) {
  const [, setLocation] = useLocation()
  const { data } = useQuery({
    queryKey: ["profile-avatar", user?.id],
    queryFn: fetchAvatar,
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
  })
  if (!user) return null
  const label = user.user_metadata?.name || user.email
  return (
    <button onClick={() => setLocation("/profile")} aria-label="My profile" title="My profile" data-testid="header-avatar"
      className="rounded-full hover:ring-2 hover:ring-green-300 transition">
      <UserAvatar src={data} label={label} size={32} />
    </button>
  )
}
