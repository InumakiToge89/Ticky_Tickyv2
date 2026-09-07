import {
    workbookToBytes
} from "@office-kit/xlsx/io";

import {
    createWorkbook,
    addWorksheet
} from "@office-kit/xlsx/workbook";

import {
    setCell
} from "@office-kit/xlsx/worksheet";

import {
    makeBarChart,
    makeBarSeries,
    makeChartSpace
} from "@office-kit/xlsx/chart";

import {
    addChartAt
} from "@office-kit/xlsx/drawing";

import {
    writeFile
} from "node:fs/promises";


// =====================================================
// CREATE WORKBOOK
// =====================================================

const workbook =
    createWorkbook();


// =====================================================
// CREATE SHEET
// =====================================================

const sheet =
    addWorksheet(
        workbook,
        "Chart Test"
    );


// =====================================================
// ADD DATA
// =====================================================

setCell(
    sheet,
    1,
    1,
    "Category"
);

setCell(
    sheet,
    1,
    2,
    "Duration"
);


setCell(
    sheet,
    2,
    1,
    "TEAMS"
);

setCell(
    sheet,
    2,
    2,
    3600
);


setCell(
    sheet,
    3,
    1,
    "MEMBERS"
);

setCell(
    sheet,
    3,
    2,
    5400
);


// =====================================================
// CREATE REAL EXCEL CHART
// =====================================================

const chart =
    makeBarChart({

        barDir:
            "col",

        grouping:
            "clustered",

        series: [

            makeBarSeries({

                idx: 0,

                tx: {
                    kind: "literal",
                    value: "Profiling Time"
                },

                cat: {
                    ref:
                        "'Chart Test'!$A$2:$A$3"
                },

                val: {
                    ref:
                        "'Chart Test'!$B$2:$B$3"
                }

            })

        ]

    });


const chartSpace =
    makeChartSpace({

        plotArea: {
            chart
        },

        title:
            "Profiling Time Breakdown",

        legend: {
            position:
                "r"
        }

    });


// =====================================================
// PLACE CHART
// =====================================================

addChartAt(
    sheet,
    "D2",

    {
        space:
            chartSpace
    },

    {
        widthPx:
            500,

        heightPx:
            320
    }

);


// =====================================================
// SAVE EXCEL FILE
// =====================================================

const excelBytes =
    await workbookToBytes(
        workbook
    );


await writeFile(
    "chart-test.xlsx",
    excelBytes
);


console.log(
    "SUCCESS! chart-test.xlsx was created."
);