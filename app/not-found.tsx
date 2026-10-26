import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page empty">
      <h1>Halaman tidak ditemukan.</h1>
      <p>Periksa kembali alamat halaman yang kamu buka.</p>
      <Link className="button" href="/">
        Kembali ke beranda
      </Link>
    </div>
  );
}
