import os
import base64
import pandas as pd
import pymongo
from pydicom import dcmread
from PIL import Image
import csv

def find_information(value):
    csv_file="train.csv"
    column_name="image_id"
    selected_rows=[]
    with open(csv_file,'r') as file:
        reader=csv.DictReader(file)
        for row in reader:
            if row[column_name]==value:
                selected_rows.append(row)

    return selected_rows




def convert_dicom_to_jpg():
    dicom_folder_path=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\dicomToPng\dicomImages"
    output_folder_path=r"C:\Users\Naz\PycharmProjects\annotating-chest-xray-images\annotation-backend\dicomToPng\pngImages"

    for filename in os.listdir(dicom_folder_path):
        dicom_file_path = os.path.join(dicom_folder_path, filename)

        if filename.endswith("dicom"):
            name = os.path.splitext(filename)[0]
            data=find_information(name)

            # Read DICOM file
            dicom=dcmread(dicom_file_path)

            # Convert DICOM to JPEG
            image=dicom.pixel_array
            image=Image.fromarray(image)

            output_file_path = os.path.join(output_folder_path, os.path.splitext(filename)[0] + ".png")
            image.save(output_file_path)

            with open(output_file_path,"rb") as file:
                encoded_image=base64.b64encode(file.read())

            image_dict={
                "filename":name,
                "data":data
            }
            print(image_dict)


convert_dicom_to_jpg()

