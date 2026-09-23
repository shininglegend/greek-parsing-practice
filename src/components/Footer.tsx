export function Footer() {
  return (
    <>
      <hr />
      <div className="text-xs text-slate-500">
        Morphology data provided by{" "}
        <a className="text-blue-500" href="https://github.com/morphgnt/morphgnt-api">
          MorphGNT
        </a>
        <hr />
        Copyright 2025 Titus Murphy. All rights reserved. For issues or requests, submit an issue by
        clicking{" "}
        <a
          className="text-blue-500 font-bold"
          href="https://github.com/shininglegend/greek-parsing-practice/issues"
        >
          here.
        </a>
      </div>
    </>
  );
}
