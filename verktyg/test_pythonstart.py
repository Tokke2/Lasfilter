#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tester för pythonstart.py. Kör: python3 -m unittest -v verktyg/test_pythonstart.py

Det viktigaste som testas är att allt följer mappen: flyttar man appmappen ska
skriptet hitta den nya platsen, upptäcka att miljön pekar fel och bygga om den –
utan att någonsin skriva utanför appmappen.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "pythonstart.py"
sys.path.insert(0, str(HERE))

import pythonstart as ps  # noqa: E402


def run_script(cwd: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(cwd / "pythonstart.py"), *args],
                          capture_output=True, text=True, cwd=str(cwd), timeout=120)


class PortableFolderTests(unittest.TestCase):
    """Skriptet ska följa mappen, inte minnas en gammal sökväg."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="pythonstart-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def make_app(self, name: str = "App") -> Path:
        app = self.tmp / name
        app.mkdir()
        shutil.copy2(SCRIPT, app / "pythonstart.py")
        (app / "pdfsorter.py").write_text("print('hej från appen')\n", encoding="utf-8")
        return app

    def test_app_dir_ar_mappen_dar_skriptet_ligger(self):
        app = self.make_app()
        info = json.loads(run_script(app, "--check", "--json").stdout)
        self.assertEqual(Path(info["app_dir"]), app.resolve())

    def test_mappen_kan_flyttas_och_allt_foljer_med(self):
        app = self.make_app("Flyttbar")
        first = json.loads(run_script(app, "--check", "--json").stdout)
        self.assertEqual(Path(first["app_dir"]), app.resolve())
        moved = self.tmp / "Ny plats" / "Flyttbar"
        moved.parent.mkdir()
        shutil.move(str(app), str(moved))
        second = json.loads(run_script(moved, "--check", "--json").stdout)
        self.assertEqual(Path(second["app_dir"]), moved.resolve(), "nya platsen hittas")
        self.assertTrue(second["all_inside_app"], "allt som skapas ligger i appmappen")
        self.assertEqual(Path(second["entry"]), (moved / "pdfsorter.py").resolve(), "huvudfilen hittas på nya platsen")

    def test_check_skapar_ingenting(self):
        app = self.make_app()
        run_script(app, "--check")
        self.assertFalse((app / ".venv").exists(), "--check får inte bygga något")
        self.assertFalse((app / ".setup").exists())

    def test_miljo_som_pekar_pa_gammal_python_raknas_som_trasig(self):
        app = self.make_app()
        venv = app / ".venv"
        venv.mkdir()
        (venv / "pyvenv.cfg").write_text("home = " + str(self.tmp / "finns-inte") + "\n", encoding="utf-8")
        stale, why = ps.venv_is_stale(app)
        self.assertTrue(stale, "miljön med en borta-baserad Python ska byggas om")
        self.assertIn("inte finns kvar", why)

    def test_miljo_utan_korfil_raknas_som_trasig(self):
        app = self.make_app()
        venv = app / ".venv"
        venv.mkdir()
        (venv / "pyvenv.cfg").write_text("home = " + sys.prefix + "\n", encoding="utf-8")
        stale, why = ps.venv_is_stale(app)
        self.assertTrue(stale)
        self.assertIn("python saknas", why)

    def test_flytt_upptacks_aven_utan_att_miljon_ar_trasig(self):
        app = self.make_app()
        app.joinpath(".venv").mkdir()
        ps.write_state({"app_dir": str(self.tmp / "Gammal plats")}, app)
        self.assertTrue(ps.moved_since_last_run(app), "en annan sparad sökväg betyder flyttad mapp")
        ps.write_state({"app_dir": str(app)}, app)
        self.assertFalse(ps.moved_since_last_run(app), "samma mapp betyder ingen flytt")

    def test_vagrar_starta_fil_utanfor_appmappen(self):
        app = self.make_app()
        outside = self.tmp / "utanfor.py"
        outside.write_text("print('får inte köras')\n", encoding="utf-8")
        # Miljön byggs först; det är själva starten som ska vägras.
        run_script(app, "--check")
        result = run_script(app, "--run", str(outside))
        self.assertEqual(result.returncode, 2, "en fil utanför appmappen startas aldrig")
        self.assertIn("utanför appmappen", result.stdout + result.stderr)

    def test_huvudfil_hittas_i_appmappen(self):
        app = self.make_app()
        self.assertEqual(ps.discover_entry(app), (app / "pdfsorter.py").resolve())
        (app / "main.py").write_text("print(1)\n", encoding="utf-8")
        self.assertEqual(ps.discover_entry(app), (app / "main.py").resolve(), "main.py går före pdfsorter.py")


class PackageTests(unittest.TestCase):
    """Paketen ska bara installeras om när requirements.txt faktiskt ändrats."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="pythonstart-pkg-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_ingen_requirements_betyder_inget_att_gora(self):
        self.assertFalse(ps.packages_need_update(self.tmp))
        self.assertEqual(ps.requirements_hash(self.tmp), "")

    def test_andrad_requirements_ger_uppdatering(self):
        req = self.tmp / "requirements.txt"
        req.write_text("requests==2.32.0\n", encoding="utf-8")
        self.assertTrue(ps.packages_need_update(self.tmp), "första gången behöver paketen installeras")
        ps.write_state({"requirements_sha256": ps.requirements_hash(self.tmp)}, self.tmp)
        self.assertFalse(ps.packages_need_update(self.tmp), "oförändrad fil kräver ingen ny installation")
        req.write_text("requests==2.33.0\n", encoding="utf-8")
        self.assertTrue(ps.packages_need_update(self.tmp), "ändrad fil upptäcks")

    def test_inga_sokvagar_pekar_utanfor_appmappen(self):
        info = ps.status(self.tmp)
        self.assertTrue(info["all_inside_app"])
        self.assertTrue(str(info["venv"]).startswith(str(self.tmp.resolve())))


class EndToEndTests(unittest.TestCase):
    """Hela vägen: bygg miljön i en flyttad mapp och starta appen."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="pythonstart-e2e-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def test_appen_startar_i_miljon_och_rapporterar_sin_plats(self):
        app = self.tmp / "App"
        app.mkdir()
        shutil.copy2(SCRIPT, app / "pythonstart.py")
        (app / "main.py").write_text(
            "import os, sys\nprint('körs från', os.getcwd())\nprint('tolk', sys.executable)\n",
            encoding="utf-8")
        built = run_script(app, "--check")
        self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
        result = subprocess.run([sys.executable, str(app / "pythonstart.py"), "--run"],
                                capture_output=True, text=True, cwd=str(app), timeout=300)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("körs från", result.stdout)
        venv_python = app / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python3")
        self.assertTrue(venv_python.exists(), "appen startades med miljöns egen Python")
        self.assertIn(str(venv_python), result.stdout, "rätt tolk användes")

        # Flytta hela mappen och starta igen: det ska gå utan att bygga om något utanför.
        moved = self.tmp / "Flyttad app"
        shutil.move(str(app), str(moved))
        again = subprocess.run([sys.executable, str(moved / "pythonstart.py"), "--run"],
                               capture_output=True, text=True, cwd=str(moved), timeout=300)
        self.assertEqual(again.returncode, 0, again.stdout + again.stderr)
        self.assertIn("körs från", again.stdout)
        self.assertTrue((moved / ".venv").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
