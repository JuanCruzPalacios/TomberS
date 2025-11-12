"""Aplicacion Flask para servir el frontend de Tombers.
Se delega la logica de negocio en el backend REST desarrollado con Spring Boot."""

from flask import Flask, render_template, request

app = Flask(__name__)


@app.route("/")
def index():
    """Renderiza la pagina de inicio con los formularios de autenticacion."""
    return render_template("index.html")


@app.route("/feed")
def feed():
    """Renderiza el panel principal con el listado de proyectos."""
    return render_template("feed.html")


@app.route("/bio")
def bio():
    """Renderiza la vista de perfil del usuario autenticado."""
    return render_template("Bio.html")


@app.route("/mis-proyectos")
def my_projects():
    """Renderiza la vista de proyectos creados por el usuario."""
    return render_template("my_projects.html")


@app.route("/proyectos-miembro")
def member_projects():
    """Renderiza la vista de proyectos en los que el usuario es miembro."""
    return render_template("member_projects.html")


@app.route("/mis-proyectos/<int:project_id>/interesados")
def project_interested(project_id: int):
    """Renderiza la lista de interesados para un proyecto determinado."""
    project_title = request.args.get("title", "")
    return render_template("interested.html", project_id=project_id, project_title=project_title)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
