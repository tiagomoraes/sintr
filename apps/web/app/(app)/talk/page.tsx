import { redirect } from "next/navigation";

/** Talk became the home: a new conversation starts there. */
export default function TalkPage() {
  redirect("/home");
}
