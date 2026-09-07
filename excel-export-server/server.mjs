import express from "express";
import cors from "cors";

import {
    loadWorkbook,
    workbookToBytes
} from "@office-kit/xlsx/io";

import {
    fromBuffer
} from "@office-kit/xlsx/node";

import {
    makeBarChart,
    makeBarSeries,
    makeChartSpace
} from "@office-kit/xlsx/chart";

import {
    addChartAt
} from "@office-kit/xlsx/drawing";

import {
    setCell,
    getCell
} from "@office-kit/xlsx/worksheet";


const app = express();

const PORT = process.env.PORT || 3001;


app.use(
    cors()
);


app.use(
    express.json({
        limit: "20mb"
    })
);


// =====================================================
// ADD REAL EXCEL CHARTS TO THE ALREADY-DESIGNED FILE
// =====================================================

app.post(
    "/add-charts",

    async (
        request,
        response
    ) => {

        try {

            // =================================================
            // CHECK XLSX DATA
            // =================================================

            const base64Xlsx =
                request.body?.xlsx;


            if (
                !base64Xlsx
            ) {

                return response
                    .status(400)
                    .send(
                        "No XLSX file data was received."
                    );

            }


            // =================================================
            // BASE64 -> BUFFER
            // =================================================

            const xlsxBuffer =
                Buffer.from(
                    base64Xlsx,
                    "base64"
                );


            // =================================================
            // LOAD EXISTING WORKBOOK
            // =================================================

            const workbook =
                await loadWorkbook(
                    fromBuffer(
                        xlsxBuffer
                    )
                );


            // =================================================
            // GET REPORT SUMMARY
            // =================================================
            // Your old exportCsv() creates Report Summary FIRST.

            const summaryReference =
                workbook.sheets[0];


            if (
                !summaryReference ||
                summaryReference.kind !== "worksheet"
            ) {

                throw new Error(
                    "The first worksheet could not be loaded."
                );

            }


            const summarySheet =
                summaryReference.sheet;


            // =================================================
            // PROFILING CHART
            // =================================================
            //
            // IMPORTANT:
            // Your old exportCsv() stores displayed durations
            // as text such as "97:02:06".
            //
            // Therefore we create numeric helper values far
            // to the right of the report so the chart can use
            // actual numeric seconds.
            //
            // AX = 50
            // AY = 51
            // =================================================

            const profilingTeamsCell =
                summarySheet.getCell
                    ? summarySheet.getCell("AX2")
                    : null;


            // We don't rely on getCell.
            // Read the displayed duration strings directly
            // from the existing report cells and convert them.

            function durationToSeconds(
                value
            ) {

                if (
                    typeof value === "number"
                ) {

                    return value;

                }


                const parts =
                    String(
                        value || "0:0:0"
                    ).split(":");


                if (
                    parts.length !== 3
                ) {

                    return 0;

                }


                const hours =
                    Number(
                        parts[0]
                    ) || 0;


                const minutes =
                    Number(
                        parts[1]
                    ) || 0;


                const seconds =
                    Number(
                        parts[2]
                    ) || 0;


                return (
                    hours * 3600 +
                    minutes * 60 +
                    seconds
                );

            }


            const teamsCell =
                getCell(
                    summarySheet,
                    14,
                    2
                );


            const membersCell =
                getCell(
                    summarySheet,
                    15,
                    2
                );


            const teamsDuration =
                teamsCell?.value ??
                "0:00:00";


            const membersDuration =
                membersCell?.value ??
                "0:00:00";


            // =================================================
            // USE WORKSHEET SETCELL
            // =================================================

            const {
                setCell
            } = await import(
                "@office-kit/xlsx/worksheet"
            );


            setCell(
                summarySheet,
                2,
                50,
                "TEAMS"
            );


            setCell(
                summarySheet,
                2,
                51,
                durationToSeconds(
                    teamsDuration
                )
            );


            setCell(
                summarySheet,
                3,
                50,
                "MEMBERS"
            );


            setCell(
                summarySheet,
                3,
                51,
                durationToSeconds(
                    membersDuration
                )
            );


            // =================================================
            // PROFILING CHART
            // =================================================

            const profilingChart =
                makeBarChart(
                    {

                        barDir:
                            "col",

                        grouping:
                            "clustered",

                        series: [

                            makeBarSeries(
                                {

                                    idx:
                                        0,

                                    tx: {

                                        kind:
                                            "literal",

                                        value:
                                            "Profiling Time"

                                    },

                                    cat: {

                                        ref:
                                            "'Report Summary'!$AX$2:$AX$3"

                                    },

                                    val: {

                                        ref:
                                            "'Report Summary'!$AY$2:$AY$3"

                                    }

                                }
                            )

                        ]

                    }
                );


            const profilingChartSpace =
                makeChartSpace(
                    {

                        plotArea: {

                            chart:
                                profilingChart

                        },

                        title:
                            "Profiling Time Breakdown",

                        legend: {

                            position:
                                "r"

                        }

                    }
                );


            addChartAt(
                summarySheet,

                "J4",

                {

                    space:
                        profilingChartSpace

                },

                {

                    widthPx:
                        520,

                    heightPx:
                        300

                }
            );


            // =================================================
            // WORK ACTIVITY CHART
            // =================================================

            const workCategories = [

                "PROD",
                "NON-PROD",
                "PROD LOSS",
                "TRAINING"

            ];


            for (
                let i = 0;
                i < workCategories.length;
                i++
            ) {

                const reportRow =
                    19 + i;


                const helperRow =
                    6 + i;


                const categoryCell =
                    getCell(
                        summarySheet,
                        reportRow,
                        1
                    );


                const durationCell =
                    getCell(
                        summarySheet,
                        reportRow,
                        2
                    );


                setCell(
                    summarySheet,
                    helperRow,
                    50,
                    categoryCell?.value ||
                    workCategories[i]
                );


                setCell(
                    summarySheet,
                    helperRow,
                    51,
                    durationToSeconds(
                        durationCell?.value
                    )
                );

            }


            const workActivityChart =
                makeBarChart(
                    {

                        barDir:
                            "col",

                        grouping:
                            "clustered",

                        series: [

                            makeBarSeries(
                                {

                                    idx:
                                        0,

                                    tx: {

                                        kind:
                                            "literal",

                                        value:
                                            "Work Activity Duration"

                                    },

                                    cat: {

                                        ref:
                                            "'Report Summary'!$AX$6:$AX$9"

                                    },

                                    val: {

                                        ref:
                                            "'Report Summary'!$AY$6:$AY$9"

                                    }

                                }
                            )

                        ]

                    }
                );


            const workActivityChartSpace =
                makeChartSpace(
                    {

                        plotArea: {

                            chart:
                                workActivityChart

                        },

                        title:
                            "Work Activity Breakdown",

                        legend: {

                            position:
                                "b"

                        }

                    }
                );


            addChartAt(
                summarySheet,

                "J21",

                {

                    space:
                        workActivityChartSpace

                },

                {

                    widthPx:
                        520,

                    heightPx:
                        300

                }

            );


            // =================================================
            // HIDE HELPER COLUMNS
            // =================================================
            //
            // If your installed package exposes column hiding,
            // we can hide AX:AY later. For now the data is far
            // outside the visible report area.
            // =================================================


            // =================================================
            // WRITE FINAL XLSX
            // =================================================

            const finalBytes =
                await workbookToBytes(
                    workbook
                );


            // =================================================
            // SEND FILE BACK
            // =================================================

            response.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );


            response.setHeader(
                "Content-Disposition",
                'attachment; filename="ticky-ticky-report.xlsx"'
            );


            response.send(
                Buffer.from(
                    finalBytes
                )
            );

        }

        catch (
            error
        ) {

            console.error(
                "Chart export error:",
                error
            );


            response
                .status(500)
                .send(
                    error.message ||
                    "Failed to add charts to Excel."
                );

        }

    }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Excel chart server running on port ${PORT}`
        );
    }
);