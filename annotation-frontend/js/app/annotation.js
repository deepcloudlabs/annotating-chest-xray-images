/**
 * @author Binnur Kurt <binnur.kurt@deepcloudlabs.com>
 * CxrViewModel is a view model for index.html
 */
class AnnotationViewModel {
    constructor() {
        //region labels
        this.anomalies = ["ATELECTASIS", "CARDIOMEGALY", "CONSOLIDATION", "EDEMA", "EFFUSION", "EMPHYSEMA",
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

        this.anomalyFeedback = ko.observable("NO_FINDING");
        this.iou = ko.observable("Not available");
        this.anomalyLayers = {}
        this.anomaly = ko.observable(this.anomalies[1]);
        this.anomaly.subscribe(anomaly => {
            for (let layer of this.drawnItems.getLayers()) {
                this.drawnItems.removeLayer(layer)
            }
            if (anomaly === "ALL") {
                for (let label of this.anomalies) {
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
        }, this,"beforeChange");

        this.isXrayLoaded = ko.observable(false);
    }

    zoomElement = async (item, event) => {
        let element = event.target;
        if (document.fullscreenElement == element)
            document.exitFullscreen();
        else
            element.requestFullscreen();
    }

    loadRandomXrayImage = async () => {

        fetch(`${AppConfig.BASE_URL}/x-ray/images`)

            .then(res => res.json())
            .then(res => {
                res.image = toSrcImage(res.image)
                this.loadFile(res.image)
                .then(next => {
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
            minZoom: -2,
            maxZoom: 2,
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
                polygon: true,
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
                color: this.anomalyColors[this.anomaly()],
                fillColor: this.anomalyColors[this.anomaly()]
            });
            let feature = e.layer.feature = e.layer.feature || {};

            feature.type = feature.type || "Feature";
            let props = feature.properties = feature.properties || {}; // Initialize feature.properties
            props.anomaly = this.anomaly();
            this.drawnItems.addLayer(e.layer);
        });

        let imageBounds = [[0, 0], [dims.width, -dims.height]];
        L.imageOverlay(newImage, imageBounds).addTo(this.map);
        this.map.fitBounds(imageBounds);
        //this.map.setMaxBounds([[0, 0], [ dims.width, -dims.height]]);
        this.anomaly("ALL");
    }

    retrieveAnnotations = (annotation) => {
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
    evaluate=async()=>{
        for (let label of this.anomalies) {
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

        let geoJson = JSON.stringify(this.drawnItems.toGeoJSON());
            fetch(`${AppConfig.BASE_URL}/x-ray/evaluate`,
            {
            method: "POST",
            headers:{ "Content-Type":"application/json",
                       "Accept":"application/json"
            },
            body: JSON.stringify({
                user_id: 1,
                input_id:42,
                annotation: geoJson
            })
        })
            .then(res => res.json())
            .then(res => {
            console.log(res);
                if (res.status.toString() === 'fail') {
                    toastr.error(res.reason);}
                else if (res.status.toString() === 'success'){
                    toastr.success(`Annotations are successfully saved and IoU is ${res.iou}.`);
                    this.iou(res.iou);
                }
            })
            .catch((error) => {
                toastr.error(error);
            });
    }


    saveAnnotations = async () => {
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
        let geoJson = JSON.stringify(this.drawnItems.toGeoJSON());
        fetch(`${AppConfig.BASE_URL}/annotations/${this.file_upload.input_id}`, {
            method: "PUT",
            headers: this.getRequestHeader(),
            body: JSON.stringify({
                user_id: this.user.user_id(),
                input_id: this.file_upload.input_id,
                annotation: geoJson
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
