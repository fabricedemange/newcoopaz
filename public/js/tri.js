function enableTableSort(tableId)  {
  const table = document.getElementById(tableId);
  if (!table) return;

  const headers = table.querySelectorAll("th");
  let sortDirections = Array(headers.length).fill(true);

  headers.forEach((th, col) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", function() {
      sortDirections[col] = !sortDirections[col];
      let rows = Array.from(table.tBodies[0].rows);

      rows.sort((a, b) => {
        let x = a.cells[col].innerText.trim();
        let y = b.cells[col].innerText.trim();

        // Gère les nombres
        if (!isNaN(x) && !isNaN(y) && x !== "" && y !== "") {
          x = Number(x);
          y = Number(y);
        } else {
          // Insensibilité à la casse pour les chaînes
          x = x.toLowerCase();
          y = y.toLowerCase();
        }

        // Gère les dates jj/mm/aaaa
        if (/\d{2}\/\d{2}\/\d{4}/.test(x) && /\d{2}\/\d{2}\/\d{4}/.test(y)) {
          const [dx, mx, ax] = x.split("/");
          const [dy, my, ay] = y.split("/");
          x = new Date(`${ax}-${mx}-${dx}`);
          y = new Date(`${ay}-${my}-${dy}`);
        }

        if (x < y) return sortDirections[col] ? -1 : 1;
        if (x > y) return sortDirections[col] ? 1 : -1;
        return 0;
      });

      rows.forEach(row => table.tBodies[0].appendChild(row));
    });
  });
}