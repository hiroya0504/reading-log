import Link from "next/link";
import { BookForm } from "../../BookForm";
import { createBookAction } from "../../actions";

export default function NewBookPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/" className="w-fit text-sm text-accent no-underline hover:underline">
        ← 本棚に戻る
      </Link>
      <h1 className="font-serif text-[32px] font-bold">本を登録する</h1>
      <BookForm action={createBookAction} />
    </main>
  );
}
