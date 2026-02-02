// Initialisation DataTables pour la vue admin_users
$(document).ready(function () {
  setTimeout(function () {
    var tableEl = $("#usersTable");
    if (tableEl.length === 0) {
      // Table non présente sur cette page, ignorer silencieusement
      return;
    }
    if ($.fn.dataTable.isDataTable(tableEl)) {
      tableEl.DataTable().destroy();
    }
    var table = tableEl.DataTable({
      pageLength: 100,
      lengthChange: false,
      searching: true,
      language: {
        url: "//cdn.datatables.net/plug-ins/1.13.6/i18n/fr-FR.json",
      },
    });
    var filterEl = $("#uniqueFilter");
    if (filterEl.length === 0) {
      // Filtre non présent, ignorer
      return;
    }
    filterEl.on("input", function () {
      table.search(this.value).draw();
    });
  }, 50); // Attendre que le DOM soit bien prêt
});
