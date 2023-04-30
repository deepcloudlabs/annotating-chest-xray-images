/**
 * @author Binnur Kurt <binnur.kurt@deepcloudlabs.com>
 * CxrViewModel is a view model for index.html
 */
class AnnotationViewModel {
    constructor() {
        //region labels
        this.anomalies = ["NO_DISEASE","ATELECTASIS", "CARDIOMEGALY", "CONSOLIDATION", "EDEMA", "EFFUSION", "EMPHYSEMA",
            "FIBROSIS", "HERNIA", "INFILTRATION", "LESION", "LUNG_OPACITY", "MASS", "NODULE", "PLEURAL_EFFUSION",
            "PLEURAL_THICKENING", "PNEUMONIA", "PNEUMOTHORAX", "SUPPORT_DEVICES"]
        this.anomaliesWithAll = ["ALL", ...this.anomalies]
        this.anomalyColors = {
            "ATELECTASIS": "red",
            "CARDIOMEGALY": "AntiqueWhite",
            "CONSOLIDATION": "Aqua",
            "EDEMA": "LightSeaGreen",
            "EFFUSION": "BlueViolet",
            "EMPHYSEMA": "Orchid",
            "FIBROSIS": "DarkSalmon",
            "HERNIA": "GoldenRod",
            "INFILTRATION": "Fuchsia",
            "LESION": "PaleGreen",
            "LUNG_OPACITY": "MediumPurple",
            "MASS": "DarkKhaki",
            "NODULE": "DarkGreen",
            "PLEURAL_EFFUSION": "Linen",
            "PLEURAL_THICKENING": "Chocolate",
            "PNEUMONIA": "LavenderBlush",
            "PNEUMOTHORAX": "Coral",
            "SUPPORT_DEVICES": "PeachPuff"
        };
        //endregion

        this.fileData = ko.observable({
            dataUrl: ko.observable(AppConfig.NO_IMAGE),
            filename: ko.observable("")
        });
        this.fileData().dataUrl.subscribe(image => {
            this.xrayImageLoaded(true);
            this.loadFile(image.toString()).then(() => {
                toastr.success(`X-Ray Image is successfully loaded.`);
            });
        })
        this.xrayImageLoaded = ko.observable(false);
        this.xrayImageId = ko.observable();

        //region user information
        this.userId = ko.observable("jack@example.com");
        this.userFullName = ko.observable("Jack Shephard");
        this.userRole = ko.observable("Student");
        this.userRole.subscribe(newUserRole => {
            this.xrayImageLoaded(false);
        })
        //endregion

        //region iou and score and disease score
        this.iou = ko.observable(Number.NaN);
        this.diseaseScore = ko.observable(Number.NaN);
        this.score=ko.observable(0);
        //endregion

        this.savedValue=localStorage.getItem('this.score()');
        if (this.savedValue !== null) {
            this.score(this.savedValue);}
        this.score.subscribe(function (newValue) {
            localStorage.setItem('score', newValue);
            });

        //region ground truth and annotation anomaly
        this.groundTruthAnomaly=ko.observable("Not available");
        this.annotationAnomaly=ko.observable("Not available");
        //endregion

        this.anomalyLayers = {}
        this.anomaly = ko.observable(this.anomalies[0]);

        this.anomaly.subscribe(anomaly => {
            for (const layer of this.drawnItems.getLayers()) {
                this.drawnItems.removeLayer(layer)
            }
            if (anomaly === "ALL") {
                for (const label of this.anomalies) {
                    const anomalyLayers = this.anomalyLayers[label];
                    if (anomalyLayers) {
                        for (let layer of anomalyLayers) {
                            this.drawnItems.addLayer(layer);
                            layer.setStyle({
                                weight: 8,
                                color: this.anomalyColors[label],
                                fillColor: this.anomalyColors[label]
                            });
                            layer.bindTooltip(label, {permanent: false, offset: [0, 0]});
                        }
                    }
                }
            } else if (this.anomalyLayers[anomaly] && this.anomalyLayers[anomaly].length > 0) {
                for (let layer of this.anomalyLayers[anomaly]) {
                    this.drawnItems.addLayer(layer);
                    layer.setStyle({
                        weight: 8,
                        color: this.anomalyColors[anomaly],
                        fillColor: this.anomalyColors[anomaly]
                    });
                    layer.bindTooltip(anomaly, {permanent: false, offset: [0, 0]});
                }
            }
        });

        this.anomaly.subscribe(anomaly => {
            if (anomaly === "ALL") return;
            this.anomalyLayers[this.anomaly()] = []
            for (let layer of this.drawnItems.getLayers()) {
                this.anomalyLayers[this.anomaly()].push(layer);
                this.drawnItems.removeLayer(layer)
            }
        }, this, "beforeChange");

        this.isXrayLoaded = ko.observable(false);
    }

    zoomElement = async (item, event) => {
        let element = event.target;
        if (document.fullscreenElement == element)
            await document.exitFullscreen();
        else
            await element.requestFullscreen();
    }

    save = () => {
        fetch(`${AppConfig.BASE_URL}/x-ray/images`, {
            method: "POST",
            body: JSON.stringify({
                image: this.fileData().dataUrl(),
                annotation: this.getGeoJson(),
                userId: this.userId()
            }),
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        })
        .then(res => res.json())
        .then(res => {
            toastr.success(`Image is saved`);
       });
    }

    loadRandomXrayImage = async () => {
        this.groundTruthAnomaly("Not available");
        this.annotationAnomaly("Not available");
        this.xrayImageLoaded(false);
        fetch(`${AppConfig.BASE_URL}/x-ray/images`)
            .then(res => res.json())
            .then(res => {
                res.image = toSrcImage(res.image);
                this.xrayImageLoaded(true);
                this.loadFile(res.image)
                    .then(next => {
                        this.xrayImageId(res._id['$oid']);
                        this.retrieveAnnotations(res.annotation)
                    })
            });
    }

    loadFile = async (newImage) => {

        let dims = await getImageDimensions(newImage);
        $("#inputImageDiv").empty();
        $("#inputImageDiv").append("<div id='inputImage'></div>");
        $('#inputImage').css("width", dims.width + "px");
        $('#inputImage').css("height", dims.height + "px");

        this.map = L.map('inputImage', {
            center: [0, 0],
            crs: L.CRS.Simple,
            zoom: 0,
            minZoom: -1,
            maxZoom: 1,
            attributionControl: false
        });
        this.map.dragging.enable();
        // Initialise the FeatureGroup to store editable layers
        this.drawnItems = new L.FeatureGroup();

        this.map.addLayer(this.drawnItems);

        // Initialise the draw control and pass it the FeatureGroup of editable layers
        this.drawControl = new L.Control.Draw({
            edit: {
                featureGroup: this.drawnItems
            },
            draw: {
                position: 'topleft',
                polygon: {
                    allowIntersection: false,
                    drawError: {
                        color: '#b00b00',
                        timeout: 1000
                    },
                    shapeOptions: {
                        color: '#bada55'
                    },
                    showArea: true
                },
                polyline: false,
                rectangle: true,
                marker: false,
                circle: false,
                circlemarker: false
            }
        });
        this.map.addControl(this.drawControl);

        this.map.on(L.Draw.Event.CREATED, (e) => {
            e.layer.setStyle({
                weight: 8,
                clickable: true,
                color: this.anomalyColors[this.anomaly()],
                fillColor: this.anomalyColors[this.anomaly()]
            });
            let feature = e.layer.feature = e.layer.feature || {};
            e.layer.bindTooltip(this.anomaly(), {permanent: false, offset: [0, 0]});

            feature.type = feature.type || "Feature";
            let props = feature.properties = feature.properties || {}; // Initialize feature.properties
            props.anomaly = this.anomaly();
            this.drawnItems.addLayer(e.layer);
        });

        let imageBounds = [[0, 0], [dims.width, -dims.height]];
        L.imageOverlay(newImage, imageBounds).addTo(this.map);
        this.map.fitBounds(imageBounds);
        //this.map.setMaxBounds([[0, 0], [ dims.width, -dims.height]]);
        //this.anomaly("ALL");
    }

    retrieveAnnotations = (annotation = "{ \"features\": []}") => {
        this.anomalyLayers = {};
        for (let layer of this.drawnItems.getLayers()) {
            this.drawnItems.removeLayer(layer)
        }
        let geoJson = JSON.parse(annotation);
        for (let geoFeature of geoJson.features) {
            if (geoFeature.geometry.type === "Polygon") {
                let coordinates = [];
                for (let coordinate of geoFeature.geometry.coordinates[0]) {
                    coordinates.push([coordinate[1], coordinate[0]])
                }
                coordinates.pop()
                let layer = L.polygon(coordinates);
                let anomaly = geoFeature.properties.anomaly;
                layer.bindTooltip(anomaly, {permanent: false, offset: [0, 0]});
                layer.setStyle({
                    weight: 8,
                    color: this.anomalyColors[anomaly],
                    fillColor: this.anomalyColors[anomaly]
                });
                let feature = layer.feature = layer.feature || {};
                feature.type = feature.type || "Feature";
                let props = feature.properties = feature.properties || {}; // Initialize feature.properties
                props.anomaly = anomaly;
                this.anomaly(anomaly)
                this.drawnItems.addLayer(layer);
                if (!this.anomalyLayers.hasOwnProperty(anomaly))
                    this.anomalyLayers[anomaly] = [];
                this.anomalyLayers[anomaly].push(layer);
            }
        }

    }
    evaluate = async () => {
        fetch(`${AppConfig.BASE_URL}/x-ray/evaluate`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    user_id: this.userId(),
                    input_id: this.xrayImageId(),
                    annotation: this.getGeoJson()
                })
            })
            .then(res => res.json())
            .then(res => {
                if (res.status.toString() === 'fail') {
                    toastr.success(`${res.iou}`);
                    this.score(this.score()-1);
                    this.diseaseScore(res.diseaseScore);
                    this.groundTruthAnomaly(res.groundTruthAnomaly);
                    this.annotationAnomaly(this.anomaly());
                    console.log("fail score",this.score());
                    console.log("fail ground ",this.groundTruthAnomaly());
                    console.log("fail annotation ",this.annotationAnomaly());

                } else if (res.status.toString() === 'success') {
                    toastr.success(`Annotations are successfully saved and IoU is ${res.iou} and score is ${res.diseaseScore}.`);
                    this.iou(res.iou);
                    this.diseaseScore(res.diseaseScore);
                    this.score(this.score()+1);
                    this.groundTruthAnomaly(res.groundTruthAnomaly);
                    this.annotationAnomaly(this.anomaly());
                    console.log("success score",this.score());
                    console.log("success ground ",this.groundTruthAnomaly());
                    console.log("success annotation ",this.annotationAnomaly());
                }
            })
            .catch((error) => {
                toastr.error(error);
            });
    }
    getGeoJson = () =>{
        for (let label of this.anomalies) {
            if (label === "ALL") continue;
            if (this.anomalyLayers[label]) {
                for (let layer of this.anomalyLayers[label]) {
                    this.drawnItems.addLayer(layer);
                    layer.setStyle({
                        weight: 8,
                        color: this.anomalyColors[label],
                        fillColor: this.anomalyColors[label]
                    });
                    layer.bindTooltip(label, {permanent: false, offset: [0, 0]});
                }
            }
        }
        return JSON.stringify(this.drawnItems.toGeoJSON());
    }

    saveAnnotations = async () => {
        fetch(`${AppConfig.BASE_URL}/annotations/${this.file_upload.input_id}`, {
            method: "PUT",
            headers: this.getRequestHeader(),
            body: JSON.stringify({
                user_id: this.user.user_id(),
                input_id: this.file_upload.input_id,
                annotation: this.getGeoJson()
            })
        })
            .then(res => res.json())
            .then(res => {
                if (res.status.toString() === 'fail') {
                    toastr.error(res.reason);
                } else {
                    toastr.success(`Annotations are successfully saved.`);
                }
            })
            .catch((error) => {
                toastr.error(error);
            });
    }

    uploadImage = (image, user_id, filename) => {
        this.isImageLoaded(false);
        fetch(`${AppConfig.BASE_URL}/images`, {
            method: "POST",
            headers: this.getRequestHeader(),
            body: JSON.stringify({image, filename, user_id})
        })
            .then(res => res.json())
            .then(res => {
                this.isImageLoaded(true);
                if (res.status.toString() === 'fail') {
                    toastr.error(res.reason);
                    this.file_upload = {request_id: "error", input_id: "error"};
                } else {
                    toastr.success(`File uploaded successfully to the server.`);
                    this.file_upload = {request_id: res.request_id, input_id: res.input_id};
                    this.retrieveAnnotations(res.input_id);
                    this.loadFeedback(res.input_id, this.user.user_id());
                }
            })
            .catch((error) => {
                this.isImageLoaded(true);
                toastr.error(error);
            });
    }

    uploadFeedback = () => {
        fetch(`${AppConfig.BASE_URL}/feedbacks/${this.file_upload.input_id}`, {
            method: "PUT",
            headers: this.getRequestHeader(),
            body: JSON.stringify({
                "anomalies": this.feedback.pickList.toList(),
                "notes": this.feedback.notes(),
                "user_id": this.user.user_id()
            })
        })
            .then(res => res.json())
            .then(res => {
                if (res.status.toString() === 'fail') {
                    toastr.error(res.reason);
                } else {
                    toastr.success(`Number of annotations is ${res.numberOfAnnotations}.`);
                }
            })
            .catch((error) => {
                toastr.error(error);
            });
    }


    insertFile = (e, data) => {
        e.preventDefault();
        let files = e.target.files || e.originalEvent.dataTransfer.files;
        let reader = new FileReader();
        reader.readAsDataURL(files[0]);
        reader.onload = event => this.fileData().dataUrl(event.target.result)
    };

    dragover = e => e.preventDefault();



}

window.addEventListener('beforeunload', function() {
    // Clear the localStorage
    localStorage.clear();
});